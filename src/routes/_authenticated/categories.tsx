import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, createCategory, deleteCategory } from "@/lib/categories.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — Piso Tracker" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const create = useServerFn(createCategory);
  const del = useServerFn(deleteCategory);
  const createMut = useMutation({
    mutationFn: (v: { name: string; kind: "income" | "expense" }) => create({ data: v }),
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {(["income", "expense"] as const).map((kind) => (
        <CategoryColumn
          key={kind}
          kind={kind}
          items={(cats.data ?? []).filter((c) => c.kind === kind)}
          onAdd={(name) => createMut.mutate({ name, kind })}
          onDelete={(id) => delMut.mutate(id)}
        />
      ))}
    </div>
  );
}

function CategoryColumn({ kind, items, onAdd, onDelete }: {
  kind: "income" | "expense";
  items: { id: string; name: string }[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle className="capitalize">{kind} categories</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(""); } }} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${kind} category`} />
          <Button type="submit">Add</Button>
        </form>
        <ul className="divide-y">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span>{c.name}</span>
              <Button size="icon" variant="ghost" onClick={() => onDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {items.length === 0 && <li className="py-2 text-sm text-muted-foreground">None.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}