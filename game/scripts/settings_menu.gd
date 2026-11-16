extends Control

# Save location and default values
const SETTINGS_PATH := "user://settings.cfg"
const DEFAULT_MASTER_VOLUME := 75.0
const DEFAULT_SENSITIVITY := 50.0
const DEFAULT_HEAD_MOVEMENT := false

# References to scene nodes
@onready var panel: PanelContainer = $SettingsPanel
@onready var padding: MarginContainer = panel.get_node("PanelPadding") as MarginContainer
@onready var layout: VBoxContainer = padding.get_node("PanelLayout") as VBoxContainer
@onready var columns: HBoxContainer = layout.get_node("Columns") as HBoxContainer
@onready var content: VBoxContainer = columns.get_node("SettingsContent") as VBoxContainer

@onready var page_title: Label = content.get_node("PageTitle") as Label
@onready var master_volume_label: Label = content.get_node("MasterVolumeLabel") as Label
@onready var master_volume_slider: HSlider = content.get_node("MasterVolumeSlider") as HSlider
@onready var sensitivity_label: Label = content.get_node("SensitivityLabel") as Label
@onready var sensitivity_slider: HSlider = content.get_node("SensitivitySlider") as HSlider
@onready
var head_movement_toggle: CheckButton = content.get_node("HeadMovementToggle") as CheckButton
@onready var restore_defaults_dialog: ConfirmationDialog = $RestoreDefaultsDialog


# Initialize the menu
func _ready() -> void:
	_load_settings()

	var reset_callable := Callable(self, "_on_restore_defaults_confirmed")
	if not restore_defaults_dialog.confirmed.is_connected(reset_callable):
		restore_defaults_dialog.confirmed.connect(reset_callable)

	_show_audio_settings()


# Page navigation buttons
func _on_audio_button_pressed() -> void:
	page_title.text = "Audio"
	_show_audio_settings()


func _on_video_button_pressed() -> void:
	page_title.text = "Video"
	_show_video_settings()


func _on_controls_button_pressed() -> void:
	page_title.text = "Controls"
	_show_controls_settings()


# Settings action buttons
func _on_apply_button_pressed() -> void:
	_save_settings()


func _on_restore_defaults_button_pressed() -> void:
	restore_defaults_dialog.popup_centered()


func _on_restore_defaults_confirmed() -> void:
	master_volume_slider.value = DEFAULT_MASTER_VOLUME
	sensitivity_slider.value = DEFAULT_SENSITIVITY
	head_movement_toggle.button_pressed = DEFAULT_HEAD_MOVEMENT


func _on_back_to_main_menu_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")


# Save and load settings
func _save_settings() -> void:
	var config := ConfigFile.new()

	config.set_value("audio", "master_volume", master_volume_slider.value)
	config.set_value("controls", "sensitivity", sensitivity_slider.value)
	config.set_value("controls", "head_movement", head_movement_toggle.button_pressed)

	var save_error: int = config.save(SETTINGS_PATH)

	if save_error == OK:
		print("Settings saved.")
	else:
		push_error("Could not save settings. Error code: " + str(save_error))


func _load_settings() -> void:
	master_volume_slider.value = DEFAULT_MASTER_VOLUME
	sensitivity_slider.value = DEFAULT_SENSITIVITY
	head_movement_toggle.button_pressed = DEFAULT_HEAD_MOVEMENT

	var config := ConfigFile.new()
	var load_error: int = config.load(SETTINGS_PATH)

	if load_error == OK:
		master_volume_slider.value = config.get_value(
			"audio", "master_volume", DEFAULT_MASTER_VOLUME
		)
		sensitivity_slider.value = config.get_value("controls", "sensitivity", DEFAULT_SENSITIVITY)
		head_movement_toggle.button_pressed = config.get_value(
			"controls", "head_movement", DEFAULT_HEAD_MOVEMENT
		)


# Show the settings that belong to each page
func _show_audio_settings() -> void:
	master_volume_label.show()
	master_volume_slider.show()

	sensitivity_label.hide()
	sensitivity_slider.hide()
	head_movement_toggle.hide()


func _show_video_settings() -> void:
	master_volume_label.hide()
	master_volume_slider.hide()
	sensitivity_label.hide()
	sensitivity_slider.hide()

	head_movement_toggle.show()


func _show_controls_settings() -> void:
	master_volume_label.hide()
	master_volume_slider.hide()
	head_movement_toggle.hide()

	sensitivity_label.show()
	sensitivity_slider.show()
