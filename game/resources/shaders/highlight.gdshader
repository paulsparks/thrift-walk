shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_back;

void fragment() {
	ALBEDO = vec3(1.0);
	ALPHA = 0.05;
}
