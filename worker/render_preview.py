"""Render a GLB to an 800x800 transparent PNG using Blender's CPU renderer.

Invoked by preview.py; can also be run with blender --background --python.
"""

import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def render(source: Path, destination: Path) -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise ValueError("Model contains no meshes")

    # Trimesh scan exports use COLOR_0 with no material definition.
    raw = source.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20 : 20 + size])
    if not document.get("materials"):
        for obj in meshes:
            material = bpy.data.materials.new("Scan vertex colors")
            material.use_nodes = True
            shader = material.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Roughness"].default_value = 0.8
            # Blender 3.0 (Ubuntu 22.04) exposes vertex_colors; newer versions
            # expose the generalized color_attributes collection.
            colors = getattr(obj.data, "color_attributes", None)
            if colors is None:
                colors = obj.data.vertex_colors
            if colors:
                color = material.node_tree.nodes.new("ShaderNodeVertexColor")
                color.layer_name = colors[0].name
                material.node_tree.links.new(
                    color.outputs["Color"], shader.inputs["Base Color"]
                )
            obj.data.materials.clear()
            obj.data.materials.append(material)

    points = [
        obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box
    ]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (low + high) / 2
    extent = (high - low).length
    if not math.isfinite(extent) or extent <= 0:
        raise ValueError("Model has invalid bounds")

    # Normalize model units so lighting and camera clipping are consistent.
    normalize = Matrix.Scale(1 / extent, 4) @ Matrix.Translation(-center)
    for obj in meshes:
        obj.matrix_world = normalize @ obj.matrix_world
    points = [normalize @ point for point in points]
    center = Vector((0, 0, 0))
    extent = 1.0
    bpy.context.view_layer.update()

    camera_data = bpy.data.cameras.new("Preview camera")
    camera = bpy.data.objects.new("Preview camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector((3, -5, 3)).normalized() * extent * 3
    camera.rotation_euler = (
        (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    camera_data.type = "ORTHO"
    rotation = camera.rotation_euler.to_matrix().transposed()
    projected = [rotation @ (point - center) for point in points]
    camera_data.ortho_scale = max(max(abs(p.x), abs(p.y)) for p in projected) * 2.3
    camera_data.clip_end = extent * 10
    camera_data.clip_start = max(extent / 10000, 0.00001)
    scene = bpy.context.scene
    scene.camera = camera
    for name, direction, power in [
        ("Key", (3, -4, 5), 8),
        ("Fill", (-4, -2, 2), 4),
        ("Rim", (1, 3, 4), 5),
    ]:
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = power * extent * extent
        light_data.shape = "DISK"
        light_data.size = extent * 2
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        light.location = center + Vector(direction).normalized() * extent * 2
        light.rotation_euler = (
            (center - light.location).to_track_quat("-Z", "Y").to_euler()
        )
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    # The container's Blender 3.0 denoiser produces an opaque, nearly black
    # image in headless CPU renders. Keep the sampled render instead.
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + ".tmp.png")
    scene.render.filepath = str(temporary)
    bpy.ops.render.render(write_still=True)
    os.replace(temporary, destination)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :]
    render(Path(args[0]).resolve(), Path(args[1]).resolve())
