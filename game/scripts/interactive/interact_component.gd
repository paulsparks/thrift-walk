@tool
class_name InteractComponent extends Node
## Put this under a CollisionObject3D to enable player interaction.

@export var tooltip: String = ""

@onready var parent := get_parent() as CollisionObject3D


func _get_configuration_warnings() -> PackedStringArray:
	if get_parent() is CollisionObject3D:
		return []

	return PackedStringArray(["Interactive must be a direct child of a CollisionObject3D."])


func _looked_at() -> void:
	ObjectHighlight.set_enabled(parent, true)

	Context.tooltip = tooltip
	Context.object = parent


func _looked_away() -> void:
	ObjectHighlight.set_enabled(parent, false)

	if Context.object == parent:
		Context.tooltip = ""
		Context.object = null


func _triggered() -> void:
	pass


func _ready() -> void:
	if parent:
		parent.set_collision_layer_value(2, true)

		parent.add_user_signal("looked_at")
		parent.add_user_signal("looked_away")
		parent.add_user_signal("triggered")

		parent.connect("looked_at", _looked_at)
		parent.connect("looked_away", _looked_away)
		parent.connect("triggered", _triggered)
