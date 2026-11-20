"""CPU-only Blender UV unwrap; invoked by texture.py."""

import sys

import bpy
import numpy as np

source, destination = sys.argv[sys.argv.index("--") + 1 :]
data = np.load(source)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
mesh = bpy.data.meshes.new("scan")
mesh.from_pydata(data["vertices"].tolist(), [], data["triangles"].tolist())
mesh.update()
obj = bpy.data.objects.new("scan", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.151917, island_margin=0.02)
bpy.ops.object.mode_set(mode="OBJECT")
uv = np.array([loop.uv[:] for loop in mesh.uv_layers.active.data])
indices = np.array([loop.vertex_index for loop in mesh.loops])
np.savez(destination, uv=uv, indices=indices)
