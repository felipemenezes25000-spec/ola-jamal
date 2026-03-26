import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock, Loader2 } from "lucide-react";
import { getDoctors } from "@/services/adminApi";
// Stats via paginated totalCount — no full list needed
import { motion } from "framer-motion";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [counts, setCounts] = useState({ total: 0, pendentes: 0, aprovados: 0, recusados: 0 });

  useEffect(() => {
    // Busca contagens por status em paralelo — cada chamada retorna totalCount do backend
    Promise.all([
      getDoctors({ page: 1, pageSize: 1 }),
      getDoctors({ status: 'pending', page: 1, pageSize: 1 }),
      getDoctors({ status: 'approved', page: 1, pageSize: 1 }),
      getDoctors({ status: 'rejected', page: 1, pageSize: 1 }),
    ])
      .then(([all, pend, appr, rej]) => {
        const getCount = (d: unknown) => {
          if (d && typeof d === 'object' && 'totalCount' in d) return (d as { totalCount: number }).totalCount;
          if (Array.isArray(d)) return d.length;
          return 0;
        };
        setCounts({
          total: getCount(all),
          pendentes: getCount(pend),
          aprovados: getCount(appr),
          recusados: getCount(rej),
        });
      })
      .catch(() => setError('Falha ao carregar dados'))
      .finally(() => setLoading(false));
  }, []);

  const { total, pendentes, aprovados, recusados } = counts;

  const stats = [
    { label: "Total de Médicos", value: total, icon: Users, color: "text-primary" },
    { label: "Pendentes", value: pendentes, icon: Clock, color: "text-warning" },
    { label: "Aprovados", value: aprovados, icon: UserCheck, color: "text-success" },
    { label: "Recusados", value: recusados, icon: UserX, color: "text-destructive" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema de médicos</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-bold mt-1">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                        <stat.icon className="h-6 w-6" aria-hidden />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Localização dos Usuários</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center rounded-lg bg-secondary/50 border border-dashed border-border">
                <p className="text-sm text-muted-foreground">Gráfico em breve</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Faixa Etária & Sexo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center rounded-lg bg-secondary/50 border border-dashed border-border">
                <p className="text-sm text-muted-foreground">Gráfico em breve</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
