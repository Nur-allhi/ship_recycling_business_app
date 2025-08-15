
"use client";

import { useRef, useState } from "react";
import { useAppContext } from "@/app/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, AlertTriangle } from "lucide-react";
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


export function ExportImportTab() {
  const { handleExport, handleImport } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export / Import Data</CardTitle>
        <CardDescription>
          Backup your entire ledger data to a file, or restore it from a backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Export Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center"><Download className="mr-2 h-5 w-5" /> Export All Data</h3>
          <p className="text-sm text-muted-foreground">
            Click the button below to download a single backup file containing all your cash, bank, and stock data. Keep this file in a safe place.
          </p>
          <Button onClick={handleExport}>
            Export Data
          </Button>
        </div>

        <Separator />

        {/* Import Section */}
        <div className="space-y-4">
           <h3 className="font-semibold text-lg flex items-center"><Upload className="mr-2 h-5 w-5" /> Import Data from Backup</h3>
           <Alert variant="destructive">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Warning: This is a destructive action.</AlertTitle>
             <AlertDescription>
                Importing a backup file will <span className="font-bold">erase all current data</span> in your ledger and replace it with the contents of the backup. This action cannot be undone.
             </AlertDescription>
           </Alert>
          <div className="space-y-2">
            <Label htmlFor="import-file">Backup File (.json or .zip)</Label>
            <Input id="import-file" type="file" ref={fileInputRef} onChange={onFileChange} accept=".json,.zip" />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!selectedFile}>
                Import Data and Overwrite Everything
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your current ledger data and replace it with the data from the selected backup file. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={triggerImport}>Yes, I understand. Overwrite my data.</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
