package main

import (
	"embed"
	_ "embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	// Go → frontend: a native menu item was clicked. Data is the originating
	// action id; the frontend resolves it through the action registry.
	application.RegisterEvent[string](MenuInvokeEvent)
	// Frontend → Go: replace the dynamic menu items wholesale.
	application.RegisterEvent[SetItemsPayload](MenuSetItemsEvent)
}

func main() {
	wm := NewWindowManager()

	app := application.New(application.Options{
		Name:        "Hollow Cube",
		Description: "Hollow Cube editor",
		Services: []application.Service{
			application.NewService(wm),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			// The launcher reopens itself when the last editor window closes,
			// so the app should stay alive across window cycles.
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})

	app.Menu.SetApplicationMenu(BuildAppMenu(app))

	// Listen for dynamic-menu updates from the frontend. The frontend
	// computes the desired item list from the action registry + context
	// set and pushes it here; we swap the application menu wholesale.
	// NSMenu calls must happen on the main thread, but event listeners
	// fire on a goroutine — so the rebuild has to be dispatched via
	// InvokeAsync.
	app.Event.On(MenuSetItemsEvent, func(e *application.CustomEvent) {
		payload, ok := e.Data.(SetItemsPayload)
		if !ok {
			log.Printf("menu:set-items: unexpected data type %T", e.Data)
			return
		}
		application.InvokeAsync(func() {
			RebuildAppMenu(app, payload.Items)
		})
	})

	// macOS: when the user clicks the dock icon with no windows open,
	// reopen the launcher rather than leaving the app stranded.
	app.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(_ *application.ApplicationEvent) {
		application.InvokeAsync(func() {
			_ = wm.OpenLauncher()
		})
	})

	if err := wm.OpenLauncher(); err != nil {
		log.Fatal(err)
	}

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
