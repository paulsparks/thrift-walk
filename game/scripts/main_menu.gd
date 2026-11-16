extends Control

func _on_play_button_pressed() -> void:
	Server.start_game()

func _on_quit_button_pressed() -> void:
	get_tree().quit()
func _on_settings_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/settings_menu.tscn")
