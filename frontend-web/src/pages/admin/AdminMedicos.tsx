import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DoctorDetailDialog } from "@/components/admin/DoctorDetailDialog";
import { RejectReasonDialog } from "@/components/admin/RejectReasonDialog";
import { ApiDoctor } from "@/types/doctor";
import { getDoctors, approveDoctor, rejectDoctor } from "@/services/adminApi";
import { Search, Eye, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AdminMedicos = () => {
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedDoctor, setSelectedDoctor] = useState<ApiDoctor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ApiDoctor | null>(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDoctors(statusFilter === "all" ? undefined : statusFilter);
      setDoctors(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar médicos.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const filtered = doctors.filter((d) => {
    const term = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(term) ||
      d.crm.includes(search) ||
      d.specialty.toLowerCase().includes(term)
    );
  });

  const handleApprove = async (id: string) => {
    try {
      await approveDoctor(id);
      toast.success("Médico aprovado com sucesso!");
      setDialogOpen(false);
      fetchDoctors();
    } catch {
      toast.error("Erro ao aprovar médico.");
    }
  };

  const openRejectDialog = (doctor: ApiDoctor) => {
    setRejectTarget(doctor);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await rejectDoctor(rejectTarget.id, reason);
      toast.success("Médico recusado.");
      setRejectDialogOpen(false);
      setDialogOpen(false);
      setRejectTarget(null);
      fetchDoctors();
    } catch {
      toast.error("Erro ao recusar médico.");
    }
  };

  const openDetail = (doctor: ApiDoctor) => {
    setSelectedDoctor(doctor);
    setDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Médicos</h1>
          <p className="text-muted-foreground">Gerencie o cadastro e a avaliação dos médicos</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  placeholder="Buscar por nome, CRM ou especialidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Buscar médicos"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="rejected">Recusados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Médico</TableHead>
                    <TableHead className="hidden md:table-cell">CRM</TableHead>
                    <TableHead className="hidden lg:table-cell">Especialidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        Nenhum médico encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((doctor) => (
                      <TableRow key={doctor.id} className="border-b transition-colors hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{doctor.name}</p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              CRM {doctor.crm}/{doctor.crmState}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {doctor.crm}/{doctor.crmState}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{doctor.specialty}</TableCell>
                        <TableCell>
                          <StatusBadge status={doctor.approvalStatus} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDetail(doctor)}
                              title="Ver detalhes"
                              aria-label={`Ver detalhes de ${doctor.name}`}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </Button>
                            {doctor.approvalStatus === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-success hover:text-success"
                                  onClick={() => handleApprove(doctor.id)}
                                  title="Aprovar"
                                  aria-label={`Aprovar ${doctor.name}`}
                                >
                                  <CheckCircle className="h-4 w-4" aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => openRejectDialog(doctor)}
                                  title="Recusar"
                                  aria-label={`Recusar ${doctor.name}`}
                                >
                                  <XCircle className="h-4 w-4" aria-hidden />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <DoctorDetailDialog
        doctor={selectedDoctor}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onApprove={handleApprove}
        onReject={(id) => {
          const doc = doctors.find((d) => d.id === id);
          if (doc) openRejectDialog(doc);
        }}
      />

      {rejectTarget && (
        <RejectReasonDialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          onConfirm={handleRejectConfirm}
          doctorName={rejectTarget.name}
        />
      )}
    </AdminLayout>
  );
};

export default AdminMedicos;
