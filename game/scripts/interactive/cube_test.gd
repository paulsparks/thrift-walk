extends StaticBody3D

@onready var mesh_instance: MeshInstance3D = $MeshInstance3D


func _ready() -> void:
	connect("triggered", change_color)


func change_color() -> void:
	var material := mesh_instance.get_surface_override_material(0) as BaseMaterial3D

	if material.albedo_color.r == 1.0:
		material.albedo_color = Color(0.0, 1.0, 0.0)
	elif material.albedo_color.g == 1.0:
		material.albedo_color = Color(0.0, 0.0, 1.0)
	elif material.albedo_color.b == 1.0:
		material.albedo_color = Color(1.0, 0.0, 0.0)
