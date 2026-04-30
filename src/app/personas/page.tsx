"use client";

import { useEffect, useState } from "react";
import { Plus, Users, Loader2, Phone, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
  employmentStatus: string;
};

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/persons")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPersons(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
          <p className="text-muted-foreground mt-1">Propietarios, Inquilinos y Garantes</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Agregar Persona
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {persons.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
              No hay personas registradas en el sistema.
            </div>
          ) : (
            persons.map((person) => (
              <Card key={person.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{person.firstName} {person.lastName}</CardTitle>
                    <p className="text-sm text-muted-foreground">DNI: {person.dni || "N/A"}</p>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{person.phone || "Sin teléfono"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{person.employmentStatus || "Indefinido"}</span>
                  </div>
                  <div className="pt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="w-full">Ver Perfil</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
