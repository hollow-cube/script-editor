package main

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

// MenuInvokeEvent is the custom event name emitted when a native menu item is
// clicked. The data is a slot id (string) — the frontend resolves it to a
// registered action via NATIVE_MENU_SLOTS and dispatches.
const MenuInvokeEvent = "menu:invoke"

// BuildAppMenu constructs the application-level native menu. Each item's
// click handler emits MenuInvokeEvent with a stable slot id so the frontend
// can dispatch through the action registry.
//
// Adding a new menu item is two edits: add the slot here in Go, and add the
// matching slot -> actionId entry in the frontend slot table. Keeping the
// structure baked in Go avoids any race between Wails binding readiness and
// frontend action registration at startup.
func BuildAppMenu(app *application.App) *application.Menu {
	menu := app.Menu.New()

	// File menu
	file := menu.AddSubmenu("File")
	emit(file.Add("New File"), app, "file.new").SetAccelerator("CmdOrCtrl+N")
	file.AddSeparator()
	emit(file.Add("Close Tab"), app, "tab.close").SetAccelerator("CmdOrCtrl+W")

	// Edit menu. The standard clipboard roles MUST live here for macOS to
	// route Cmd+C/V/X to the focused WebView — without them the OS
	// intercepts the keystrokes before they reach CodeMirror.
	edit := menu.AddSubmenu("Edit")
	edit.AddRole(application.Undo)
	edit.AddRole(application.Redo)
	edit.AddSeparator()
	edit.AddRole(application.Cut)
	edit.AddRole(application.Copy)
	edit.AddRole(application.Paste)
	edit.AddRole(application.SelectAll)
	edit.AddSeparator()
	emit(edit.Add("Search Everywhere"), app, "search.openAll")
	emit(edit.Add("Find Action…"), app, "search.openActions").SetAccelerator("F1")
	emit(edit.Add("Go to File…"), app, "search.openFiles").SetAccelerator("CmdOrCtrl+Shift+O")
	emit(edit.Add("Find in Files…"), app, "search.openText").SetAccelerator("CmdOrCtrl+Shift+F")

	return menu
}

func emit(item *application.MenuItem, app *application.App, slotId string) *application.MenuItem {
	item.OnClick(func(_ *application.Context) {
		app.Event.Emit(MenuInvokeEvent, slotId)
	})
	return item
}
