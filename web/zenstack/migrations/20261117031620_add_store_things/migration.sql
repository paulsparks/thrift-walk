-- DropForeignKey
ALTER TABLE "game_ticket" DROP CONSTRAINT "game_ticket_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "image_asset" DROP CONSTRAINT "image_asset_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "item" DROP CONSTRAINT "item_imageAssetId_fkey";

-- DropForeignKey
ALTER TABLE "item" DROP CONSTRAINT "item_storeId_fkey";

-- DropForeignKey
ALTER TABLE "item_placement" DROP CONSTRAINT "item_placement_itemId_fkey";

-- DropForeignKey
ALTER TABLE "market_request" DROP CONSTRAINT "market_request_userId_fkey";

-- DropForeignKey
ALTER TABLE "store" DROP CONSTRAINT "store_ownerId_fkey";

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_placement" ADD CONSTRAINT "item_placement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_ticket" ADD CONSTRAINT "game_ticket_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_request" ADD CONSTRAINT "market_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
