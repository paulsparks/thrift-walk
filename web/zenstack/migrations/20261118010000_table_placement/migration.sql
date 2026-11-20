-- Return existing model-on-wall placements to inventory for tabletop placement.
DELETE FROM item_placement USING item
WHERE item_placement."itemId" = item.id
  AND item."scanJobId" IS NOT NULL AND item_placement."surfaceId" <> 'lobby-table';
