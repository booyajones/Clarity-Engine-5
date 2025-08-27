import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { BatchCard } from '@/components/batch-card';
import { Upload, Package, CheckCircle2, XCircle, Clock, Eye, Trash2, MoreHorizontal, Download, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function HomeImproved() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Fetch recent batches
  const { data: batches = [], isLoading: batchesLoading } = useQuery<any[]>({
    queryKey: ['/api/upload/batches'],
  });
  
  
  // Delete batch mutation
  const deleteMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const res = await fetch(`/api/upload/batch/${batchId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete batch');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/upload/batches'] });
      toast({
        title: 'Batch deleted',
        description: 'The batch has been successfully deleted.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete the batch. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  const recentBatches = Array.isArray(batches) ? batches : [];
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Clarity Engine 3
          </h1>
          <p className="text-slate-600">
            Professional payee classification and enrichment platform
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/home-old">
            <Button variant="outline">
              Advanced View
            </Button>
          </Link>
          <Link href="/batch-jobs">
            <Button variant="outline">
              Job Monitor
            </Button>
          </Link>
        </div>
      </div>
      
      
      {/* Main Action Area */}
      <div className="mb-8">
        <Card className="border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors">
          <CardContent className="py-12">
            <div className="text-center">
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Start New Import</h2>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Upload a CSV or Excel file containing payee data for classification and enrichment
              </p>
              <Link href="/home-old">
                <Button size="lg" className="min-w-[200px]">
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </Button>
              </Link>
              <div className="mt-4 text-xs text-slate-500">
                Supports CSV and Excel files up to 50MB
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* All Batches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">All Batches ({batches.length} total)</h2>
          {batches.length > 0 && (
            <Link href="/home-old">
              <Button variant="outline" size="sm">
                Detailed View
              </Button>
            </Link>
          )}
        </div>
        
        {batchesLoading ? (
          <Card>
            <CardContent className="p-0">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : recentBatches.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBatches.map((batch: any) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        {batch.originalFilename || batch.filename}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            batch.status === 'completed' ? 'default' :
                            batch.status === 'processing' ? 'outline' :
                            batch.status === 'failed' ? 'destructive' : 'secondary'
                          }
                        >
                          {batch.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {batch.status === 'processing' && <Clock className="h-3 w-3 mr-1" />}
                          {batch.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.totalRecords || 0}</TableCell>
                      <TableCell>
                        {batch.processedRecords || 0}
                        {batch.totalRecords > 0 && (
                          <span className="text-slate-500 ml-1">
                            ({((batch.processedRecords / batch.totalRecords) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {batch.accuracy ? `${(batch.accuracy * 100).toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {new Date(batch.createdAt).toLocaleDateString()}
                        <br />
                        <span className="text-xs">
                          {new Date(batch.createdAt).toLocaleTimeString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                localStorage.setItem('selectedBatchId', batch.id.toString());
                                setLocation('/home-old');
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/upload/batch/${batch.id}/export`, {
                                    credentials: 'include',
                                  });
                                  if (res.ok) {
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${batch.originalFilename || batch.filename}_results.csv`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                    toast({
                                      title: 'Download started',
                                      description: 'Your file is being downloaded.',
                                    });
                                  } else {
                                    throw new Error('Download failed');
                                  }
                                } catch (error) {
                                  toast({
                                    title: 'Download failed',
                                    description: 'Could not download the file. Please try again.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/upload/batch/${batch.id}/export?format=excel`, {
                                    credentials: 'include',
                                  });
                                  if (res.ok) {
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${batch.originalFilename || batch.filename}_results.xlsx`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                    toast({
                                      title: 'Download started',
                                      description: 'Your Excel file is being downloaded.',
                                    });
                                  } else {
                                    throw new Error('Download failed');
                                  }
                                } catch (error) {
                                  toast({
                                    title: 'Download failed',
                                    description: 'Could not download the Excel file. Please try again.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Download Excel
                            </DropdownMenuItem>
                            {batch.status === 'failed' && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/upload/batch/${batch.id}/retry`, {
                                      method: 'POST',
                                      credentials: 'include',
                                    });
                                    if (res.ok) {
                                      queryClient.invalidateQueries({ queryKey: ['/api/upload/batches'] });
                                      toast({
                                        title: 'Retry started',
                                        description: 'The batch is being reprocessed.',
                                      });
                                    } else {
                                      throw new Error('Retry failed');
                                    }
                                  } catch (error) {
                                    toast({
                                      title: 'Retry failed',
                                      description: 'Could not retry the batch. Please try again.',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry Processing
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this batch?')) {
                                  deleteMutation.mutate(batch.id);
                                }
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium mb-2">No imports yet</p>
                <p className="text-sm">Start by uploading your first file</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}