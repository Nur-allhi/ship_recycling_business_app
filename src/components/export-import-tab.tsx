
"use client";

import { useRef, useState } from "react";
import { useAppContext } from "@/app/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, AlertTriangle, FileText, Trash, UserX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { PdfExportDialog } from "./pdf-export-dialog";


export function ExportImportTab() {
  const { handleExport, handleImport, handleDeleteAllData, user } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const triggerImport = () => {
    if (selectedFile) {
      handleImport(selectedFile);
    }
  };

  const triggerDeleteAll = () => {
    handleDeleteAllData();
  }

  const getBackupFileName = () => {
    const backupName = "ha-mim-iron-mart-backup.json";
    if (selectedFile?.name.endsWith('.zip')) {
        const zipReader = new FileReader();
        zipReader.onload = async (e) => {
            try {
                 const jszip = (await import('jszip')).default;
                 const zip = await jszip.loadAsync(selectedFile);
                 if (zip.file(backupName)) {
                    // We're good
                 } else {
                    // For backward compatibility
                    if (zip.file("shipshape-ledger-backup.json")) {
                         // older format
                    } else {
                         // No valid file found
                    }
                 }
            } catch (err) {
                 console.error("error reading zip", err)
            }
        };
        zipReader.readAsArrayBuffer(selectedFile);
    }
    return backupName;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Export / Import Data</CardTitle>
          <CardDescription>
            Export your ledger data to PDF or create a full backup. Admins can restore from a backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Export Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center"><Download className="mr-2 h-5 w-5" /> Export Data</h3>
            <div className="flex flex-col sm:flex-row gap-4">
               <Button onClick={() => setIsPdfDialogOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" /> Export to PDF
               </Button>
               {isAdmin && 
                <Button onClick={handleExport} variant="outline">
                  Create Full Backup (.zip)
                </Button>
               }
            </div>
            <p className="text-sm text-muted-foreground">
                Export specific ledgers to PDF. Admins can create a full data backup for restoration purposes.
            </p>
          </div>

          {isAdmin && (
            <>
              <Separator />

              {/* Import Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center"><Upload className="mr-2 h-5 w-5" /> Restore from Backup</h3>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning: This is a destructive action.</AlertTitle>
                  <AlertDescription>
                      Restoring from a backup file will <span className="font-bold">erase all current data</span> in your ledger and replace it with the contents of the backup. This action cannot be undone.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="import-file">Backup File (.zip)</Label>
                  <Input id="import-file" type="file" ref={fileInputRef} onChange={onFileChange} accept=".zip" />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!selectedFile}>
                      Restore and Overwrite Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your current ledger data and replace it with the data from the selected backup file. This action cannot be undone.
                      </Aler tDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={triggerImport}>Yes, I understand. Overwrite my data.</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              
              <Separator />

              {/* Reset Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center"><UserX className="mr-2 h-5 w-5" /> Reset & Delete</h3>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning: This will delete everything.</AlertTitle>
                  <AlertDescription>
                      This action will permanently <span className="font-bold">erase all of your ledger data and all user accounts except your own</span>. This action cannot be undone.
                  </AlertDescription>
                </Alert>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      Delete All Data and Users
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This is your final confirmation. Clicking "Yes" will permanently delete all data and other user accounts. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={triggerDeleteAll}>Yes, delete all data.</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}

        </CardContent>
      </Card>
      <PdfExportDialog isOpen={isPdfDialogOpen} setIsOpen={setIsPdfDialogOpen} />
    </>
  );
}
