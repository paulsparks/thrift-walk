class_name MarketTheme
extends RefCounted
const INK := Color("28352d")
const MUTED := Color("626c60")
const PAPER := Color("f6f1e6")
const GREEN := Color("41624e")


static func surface(color: Color, padding: int = 12, radius: int = 10) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(radius)
	style.content_margin_left = padding
	style.content_margin_right = padding
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style


static func make() -> Theme:
	var theme := Theme.new()
	theme.default_font = ThemeDB.get_default_theme().get_font("font", "Label")
	theme.default_font_size = 16
	for control: String in ["Label", "Button", "OptionButton", "LineEdit", "PopupMenu"]:
		theme.set_font("font", control, theme.default_font)
	var panel := surface(PAPER, 28, 18)
	panel.content_margin_top = 24
	panel.content_margin_bottom = 24
	panel.shadow_color = Color(0, 0, 0, 0.2)
	panel.shadow_size = 16
	theme.set_stylebox("panel", "PanelContainer", panel)
	theme.set_color("font_color", "Label", INK)
	theme.set_constant("separation", "VBoxContainer", 12)
	theme.set_constant("separation", "HBoxContainer", 12)
	for control: String in ["Button", "OptionButton", "LineEdit"]:
		for state: String in [
			"font_color", "font_hover_color", "font_pressed_color", "font_focus_color"
		]:
			theme.set_color(state, control, INK)
		theme.set_color("font_disabled_color", control, MUTED)
		theme.set_stylebox("normal", control, surface(Color("e9e6da"), 16))
		theme.set_stylebox("hover", control, surface(Color("dedfce"), 16))
		theme.set_stylebox("pressed", control, surface(Color("d0d7c5"), 16))
		theme.set_stylebox("disabled", control, surface(Color("eeeade"), 16))
		var focus := surface(Color.TRANSPARENT)
		focus.border_color = GREEN
		focus.set_border_width_all(2)
		theme.set_stylebox("focus", control, focus)
	theme.set_stylebox("normal", "LineEdit", surface(Color("fffdf8"), 14))
	theme.set_color("font_placeholder_color", "LineEdit", MUTED)
	theme.set_color("caret_color", "LineEdit", GREEN)
	theme.set_color("selection_color", "LineEdit", Color("cedcc8"))
	return theme


static func primary(button: Button) -> void:
	button.add_theme_stylebox_override("normal", surface(GREEN, 18))
	button.add_theme_stylebox_override("hover", surface(Color("52775d"), 18))
	button.add_theme_stylebox_override("pressed", surface(Color("304d3a"), 18))
	for state: String in [
		"font_color", "font_hover_color", "font_pressed_color", "font_focus_color"
	]:
		button.add_theme_color_override(state, Color("fffdf8"))
