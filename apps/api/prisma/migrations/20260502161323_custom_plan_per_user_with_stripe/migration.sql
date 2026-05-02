/*
  Warnings:

  - You are about to drop the column `customPlanId` on the `organization` table. All the data in the column will be lost.
  - You are about to drop the column `customPlanId` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `custom_plan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stripePriceMonthly` to the `custom_plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stripeProductId` to the `custom_plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `custom_plan` table without a default value. This is not possible if the table is not empty.
  - Made the column `monthlyPriceBRL` on table `custom_plan` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "organization" DROP CONSTRAINT "organization_customPlanId_fkey";

-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_customPlanId_fkey";

-- AlterTable
ALTER TABLE "custom_plan" ADD COLUMN     "stripePriceMonthly" TEXT NOT NULL,
ADD COLUMN     "stripePriceYearly" TEXT,
ADD COLUMN     "stripeProductId" TEXT NOT NULL,
ADD COLUMN     "stripeStatus" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "monthlyPriceBRL" SET NOT NULL;

-- AlterTable
ALTER TABLE "organization" DROP COLUMN "customPlanId";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "customPlanId";

-- CreateIndex
CREATE UNIQUE INDEX "custom_plan_userId_key" ON "custom_plan"("userId");

-- CreateIndex
CREATE INDEX "custom_plan_stripeSubscriptionId_idx" ON "custom_plan"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "custom_plan" ADD CONSTRAINT "custom_plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
