import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Upload router for managing lot data file uploads
 * 
 * This router provides endpoints for:
 * - Uploading new Excel files with lot data
 * - Triggering backend restart to reload data
 * - Viewing upload history
 */
export const uploadRouter = router({
  /**
   * Upload a new lot data Excel file
   * Requires admin privileges
   */
  uploadLotFile: protectedProcedure
    .input(
      z.object({
        fileContent: z.string().describe("Base64 encoded Excel file content"),
        fileName: z.string().describe("Original file name"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user is admin
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can upload lot data files",
        });
      }

      try {
        // Decode base64 content
        const buffer = Buffer.from(input.fileContent, "base64");

        // Validate file size (max 10MB)
        if (buffer.length > 10 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File size exceeds 10MB limit",
          });
        }

        // Validate file extension
        if (!input.fileName.match(/\.(xlsx|xls)$/i)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only Excel files (.xlsx, .xls) are allowed",
          });
        }

        // Create backup of existing file
        const uploadDir = join(process.cwd(), "upload");
        const targetPath = join(uploadDir, "Lot_Layer_V4-1.xlsx");
        const backupPath = join(
          uploadDir,
          `Lot_Layer_V4-1.xlsx.backup-${Date.now()}`
        );

        try {
          const existingFile = await readFile(targetPath);
          await writeFile(backupPath, existingFile);
          console.log(`[Upload] Backed up existing file to ${backupPath}`);
        } catch (err) {
          console.log("[Upload] No existing file to backup");
        }

        // Write new file
        await writeFile(targetPath, buffer);
        console.log(`[Upload] New lot data file uploaded: ${input.fileName}`);

        return {
          success: true,
          message: "Lot data file uploaded successfully",
          fileName: input.fileName,
          fileSize: buffer.length,
          backupCreated: true,
          note: "Backend restart required to load new data. Use restartBackend endpoint.",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[Upload] Error uploading file:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload file",
        });
      }
    }),

  /**
   * Restart backend to reload lot data
   * Requires admin privileges
   * 
   * Note: This will only work if the backend is running under PM2
   */
  restartBackend: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only administrators can restart the backend",
      });
    }

    try {
      // Check if running under PM2
      const processName = process.env.PM2_PROCESS_NAME || "mottainai-dashboard";

      console.log(`[Upload] Attempting to restart PM2 process: ${processName}`);

      // Execute PM2 restart command
      const { stdout, stderr } = await execAsync(`pm2 restart ${processName}`);

      console.log("[Upload] PM2 restart output:", stdout);
      if (stderr) {
        console.error("[Upload] PM2 restart stderr:", stderr);
      }

      return {
        success: true,
        message: "Backend restart initiated. New lot data will be loaded.",
        note: "Please wait 3-5 seconds for the backend to fully restart.",
      };
    } catch (error) {
      console.error("[Upload] Error restarting backend:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Failed to restart backend. Manual restart may be required via PM2.",
      });
    }
  }),

  /**
   * Get list of backup files
   * Requires admin privileges
   */
  listBackups: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only administrators can view backups",
      });
    }

    try {
      const uploadDir = join(process.cwd(), "upload");
      const { readdir, stat } = await import("fs/promises");

      const files = await readdir(uploadDir);
      const backupFiles = files.filter((f) =>
        f.startsWith("Lot_Layer_V4-1.xlsx.backup-")
      );

      const backups = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = join(uploadDir, file);
          const stats = await stat(filePath);
          const timestamp = file.match(/backup-(\d+)/)?.[1];

          return {
            fileName: file,
            size: stats.size,
            createdAt: timestamp
              ? new Date(parseInt(timestamp))
              : stats.birthtime,
          };
        })
      );

      // Sort by creation date, newest first
      backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        backups,
        total: backups.length,
      };
    } catch (error) {
      console.error("[Upload] Error listing backups:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list backup files",
      });
    }
  }),

  /**
   * Restore a backup file
   * Requires admin privileges
   */
  restoreBackup: protectedProcedure
    .input(
      z.object({
        backupFileName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user is admin
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can restore backups",
        });
      }

      try {
        const uploadDir = join(process.cwd(), "upload");
        const backupPath = join(uploadDir, input.backupFileName);
        const targetPath = join(uploadDir, "Lot_Layer_V4-1.xlsx");

        // Validate backup file exists
        try {
          await readFile(backupPath);
        } catch {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Backup file not found",
          });
        }

        // Create backup of current file before restoring
        const currentBackupPath = join(
          uploadDir,
          `Lot_Layer_V4-1.xlsx.backup-${Date.now()}`
        );

        try {
          const currentFile = await readFile(targetPath);
          await writeFile(currentBackupPath, currentFile);
        } catch {
          console.log("[Upload] No current file to backup");
        }

        // Copy backup to main file
        const backupContent = await readFile(backupPath);
        await writeFile(targetPath, backupContent);

        console.log(`[Upload] Restored backup: ${input.backupFileName}`);

        return {
          success: true,
          message: "Backup restored successfully",
          restoredFile: input.backupFileName,
          note: "Backend restart required to load restored data.",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[Upload] Error restoring backup:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to restore backup",
        });
      }
    }),
});
