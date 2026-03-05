"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, Send, Sparkles, MessageSquareCode } from 'lucide-react';
import { aiCommunicationAssistant, AiCommunicationAssistantInput, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { useToast } from '@/hooks/use-toast';

export function AIAssistantView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState<Partial<AiCommunicationAssistantInput>>({
    communicationType: 'rentReminder',
  });
  const [result, setResult] = useState<AiCommunicationAssistantOutput | null>(null);

  const handleGenerate = async () => {
    if (!input.communicationType) return;
    setLoading(true);
    try {
      const output = await aiCommunicationAssistant(input as AiCommunicationAssistantInput);
      setResult(output);
    } catch (error) {
      toast({
        title: "Error al generar draft",
        description: "No se pudo contactar con el asistente de IA.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(`${result.subjectLine}\n\n${result.draftedMessage}`);
      toast({ title: "Copiado", description: "El mensaje ha sido copiado al portapapeles." });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <Card className="shadow-sm border-none bg-white h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Configurar Comunicación
          </CardTitle>
          <CardDescription>Defina los detalles para que la IA redacte su mensaje.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Comunicación</Label>
            <Select 
              value={input.communicationType} 
              onValueChange={(v) => setInput({...input, communicationType: v as any})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rentReminder">Recordatorio de Pago</SelectItem>
                <SelectItem value="leaseRenewal">Aviso de Renovación</SelectItem>
                <SelectItem value="ownerLiquidationReport">Reporte a Propietario</SelectItem>
                <SelectItem value="generalMessage">Mensaje General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre Inquilino / Dueño</Label>
              <Input 
                placeholder="Ej: Carlos Sosa" 
                onChange={e => setInput({...input, tenantName: e.target.value, ownerName: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Propiedad</Label>
              <Input 
                placeholder="Ej: Edificio Central 4B" 
                onChange={e => setInput({...input, propertyName: e.target.value})} 
              />
            </div>
          </div>

          {input.communicationType === 'rentReminder' && (
             <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Adeudado</Label>
                <Input placeholder="$ 120.000" onChange={e => setInput({...input, amountDue: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Fecha Vencimiento</Label>
                <Input placeholder="10/10/2023" onChange={e => setInput({...input, dueDate: e.target.value})} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Contexto Adicional (Opcional)</Label>
            <Textarea 
              placeholder="Ej: Mencionar que se reparó el aire acondicionado este mes." 
              className="h-24"
              onChange={e => setInput({...input, additionalContext: e.target.value})}
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={loading} 
            className="w-full bg-primary hover:bg-primary/90 text-white mt-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {result ? "Regenerar Mensaje" : "Redactar Mensaje"}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-none bg-white min-h-[400px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Borrador Generado</CardTitle>
            <CardDescription>Resultado de la redacción por IA.</CardDescription>
          </div>
          {result && (
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {!result && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
              <MessageSquareCode className="h-12 w-12" />
              <p>Configure los datos a la izquierda para ver el borrador aquí.</p>
            </div>
          )}

          {loading && (
             <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">La IA está redactando su comunicación...</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <Label className="text-xs uppercase text-muted-foreground font-bold mb-1 block">Asunto</Label>
                <p className="font-semibold text-foreground">{result.subjectLine}</p>
              </div>
              <div className="p-4 bg-muted/10 rounded-lg border whitespace-pre-wrap leading-relaxed text-foreground min-h-[250px]">
                {result.draftedMessage}
              </div>
              <Button className="w-full gap-2">
                <Send className="h-4 w-4" />
                Enviar Mensaje (Simulado)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
