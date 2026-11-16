extends CenterContainer

@export var tooltip: Control
@export var interact_key_label: Label
@export var tooltip_label: Label


func _ready() -> void:
	interact_key_label.text = InputMap.action_get_events("interact")[0].as_text().trim_suffix(
		" - Physical"
	)


func _process(_delta: float) -> void:
	if !Context.object:
		tooltip.hide()
		return

	tooltip_label.text = Context.tooltip
	if Context.tooltip.is_empty():
		tooltip_label.hide()
	else:
		tooltip_label.show()

	tooltip.show()
