-- DropForeignKey
ALTER TABLE "JournalImportDefaultAccount" DROP CONSTRAINT IF EXISTS "JournalImportDefaultAccount_defaultDbAccountId_fkey";
ALTER TABLE "JournalImportDefaultAccount" DROP CONSTRAINT IF EXISTS "JournalImportDefaultAccount_defaultCrAccountId_fkey";

-- DropTable
DROP TABLE IF EXISTS "JournalImportDefaultAccount";
