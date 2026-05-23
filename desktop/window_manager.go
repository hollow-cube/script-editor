package main

import (
	"fmt"
	"net/url"
	"runtime"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// WindowManager owns the lifecycle of every webview window the app spawns —
// the launcher and per-project editor windows. The frontend calls these
// methods via Wails service bindings; main.go also drives the launcher at
// startup and on dock reactivation.
type WindowManager struct {
	mu       sync.Mutex
	launcher *application.WebviewWindow
	editors  map[string]*application.WebviewWindow
}

func NewWindowManager() *WindowManager {
	return &WindowManager{editors: make(map[string]*application.WebviewWindow)}
}

// OpenLauncher creates the launcher window or focuses an existing one.
// Returns nil for now — the error in the signature is included so Wails
// emits a Promise-returning binding.
func (wm *WindowManager) OpenLauncher() error {
	wm.mu.Lock()
	if wm.launcher != nil {
		w := wm.launcher
		wm.mu.Unlock()
		w.Focus()
		return nil
	}
	wm.mu.Unlock()

	w := application.Get().Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                 "Hollow Cube",
		Width:                 780,
		Height:                520,
		MinWidth:              780,
		MaxWidth:              780,
		MinHeight:             520,
		MaxHeight:             520,
		MaximiseButtonState:   application.ButtonDisabled,
		FullscreenButtonState: application.ButtonDisabled,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 38,
			// Block AppKit's fullscreen path entirely — without this the
			// double-click-titlebar gesture or `View → Enter Full Screen`
			// would still work even with the toolbar button disabled.
			CollectionBehavior: application.MacWindowCollectionBehaviorFullScreenNone,
			TitleBar: application.MacTitleBar{
				AppearsTransparent:   true,
				Hide:                 false,
				HideTitle:            true,
				FullSizeContent:      true,
				UseToolbar:           true,
				ToolbarStyle:         application.MacToolbarStyleUnifiedCompact,
				HideToolbarSeparator: false,
			},
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/#/launcher",
	})
	wm.mu.Lock()
	wm.launcher = w
	wm.mu.Unlock()

	w.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		wm.handleLauncherClosed(w)
	})
	return nil
}

// OpenProject creates an editor window for the given project id (or focuses
// an existing one). After the editor opens, the launcher is closed.
func (wm *WindowManager) OpenProject(projectId string, name string) error {
	if projectId == "" {
		return fmt.Errorf("OpenProject: projectId is required")
	}

	wm.mu.Lock()
	if existing, ok := wm.editors[projectId]; ok {
		wm.mu.Unlock()
		existing.Focus()
		wm.closeLauncherIfOpen()
		return nil
	}
	wm.mu.Unlock()

	title := name
	if title == "" {
		title = projectId
	}

	w := application.Get().Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  title,
		Width:  1200,
		Height: 800,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 38,
			TitleBar: application.MacTitleBar{
				AppearsTransparent:   true,
				Hide:                 false,
				HideTitle:            true,
				FullSizeContent:      true,
				UseToolbar:           true,
				ToolbarStyle:         application.MacToolbarStyleUnifiedCompact,
				HideToolbarSeparator: false,
			},
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/#/project/" + url.PathEscape(projectId),
	})

	wm.mu.Lock()
	wm.editors[projectId] = w
	wm.mu.Unlock()

	w.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		wm.handleEditorClosed(w, projectId)
	})

	wm.closeLauncherIfOpen()
	return nil
}

func (wm *WindowManager) closeLauncherIfOpen() {
	wm.mu.Lock()
	w := wm.launcher
	wm.launcher = nil
	wm.mu.Unlock()
	if w != nil {
		w.Close()
	}
}

// handleEditorClosed clears the editor from bookkeeping. When the last
// editor closes and no launcher is open, the launcher reopens so the user
// can pick another project rather than being stranded.
func (wm *WindowManager) handleEditorClosed(w *application.WebviewWindow, projectId string) {
	wm.mu.Lock()
	if cur := wm.editors[projectId]; cur == w {
		delete(wm.editors, projectId)
	}
	remaining := len(wm.editors)
	launcherOpen := wm.launcher != nil
	wm.mu.Unlock()

	if remaining == 0 && !launcherOpen {
		application.InvokeAsync(func() {
			_ = wm.OpenLauncher()
		})
	}
}

// handleLauncherClosed is fired when the user explicitly closes the launcher
// window. On macOS the app stays alive (dock reactivation reopens the
// launcher); on Windows/Linux there's no equivalent convention, so quit
// the process when no editor windows remain.
func (wm *WindowManager) handleLauncherClosed(w *application.WebviewWindow) {
	wm.mu.Lock()
	if wm.launcher == w {
		wm.launcher = nil
	}
	remaining := len(wm.editors)
	wm.mu.Unlock()

	if remaining == 0 && runtime.GOOS != "darwin" {
		application.InvokeAsync(func() {
			application.Get().Quit()
		})
	}
}
