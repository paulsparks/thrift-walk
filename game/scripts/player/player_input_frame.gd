class_name PlayerInputFrame
extends RefCounted

## A single client input sample. The sequence is used for server acknowledgement
## and prediction replay; delta preserves the original client simulation step.
var sequence := -1
var move := Vector2.ZERO
var jump := false
var sprint := false
var yaw := 0.0
var pitch := 0.0
var delta := 0.0
