"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, Send, Sparkles, MessageSquareCode, Zap, ArrowRight } from 'lucide-react';
import { aiCommunicationAssistant, AiCommunicationAssistantInput, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { sendEmail } from '@/services/email-service';
import { useToast } from '@/hooks/use-toast';

// ── Intent routing ────────────────────────────────────────────────────────────

const COMMAND_INTENTS = [
  { cmd: '/recordatorio', label: 'Recordatorio de pago',      type: 'rentReminder'           as const, hint: 'Ej: /recordatorio Carlos Sosa Depto 4B' },
  { cmd: '/renovacion',   label: 'Aviso de renovación',       type: 'leaseRenewal'            as const, hint: 'Ej: /renovacion inquilino propiedad' },
  { cmd: '/reporte',      label: 'Reporte al propietario',    type: 'ownerLiquidationReport'  as const, hint: 'Ej: /reporte Marta Rodríguez Torre A' },
  { cmd: '/mensaje',      label: 'Mensaje general',           type: 'generalMessage'          as const, hint: 'Ej: /mensaje Juan sobre expensas' },
  { cmd: '/mantenimiento',label: 'Actualización de reclamo',  type: 'maintenanceUpdate'       as const, hint: 'Ej: /mantenimiento filtración baño Depto 3' },
];

function parseIntent(text: string): { type: AiCommunicationAssistantInput['communicationType']; context: string } | null {
  const lower = text.trim().toLowerCase();
  for (const intent of COMMAND_INTENTS) {
    if (lower.startsWith(intent.cmd)) {
      return { type: intent.type, context: text.slice(intent.cmd.length).trim() };
    }
  }
  return null;
}

export function AIAssistantView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [input, setInput] = useState<Partial<AiCommunicationAssistantInput>>({
    communicationType: 'rentReminder',
  });
  const [result, setResult] = useState<AiCommunicationAssistantOutput | null>(null);

  // Command bar
  const [cmdText, setCmdText] = useState('');
  const [cmdResult, setCmdResult] = useState<string | null>(null);

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

  const handleSend = async () => {
    if (!result || !recipientEmail) {
      toast({ title: "Falta el destinatario", description: "Ingresá el email del destinatario.", variant: "destructive" });
      return;
    }
    setIsSending(true);
    try {
      const res = await sendEmail({
        to: recipientEmail,
        subject: result.subjectLine,
        html: `<div style="font-family:sans-serif;line-height:1.7;white-space:pre-wrap;">${result.draftedMessage}</div>`,
      });
      if (res.success) {
        toast({ title: "Mensaje enviado", description: `Email enviado correctamente a ${recipientEmail}.` });
      } else {
        toast({ title: "Error al enviar", description: "No se pudo enviar el email. Verificá las credenciales.", variant: "destructive" });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleCommandRoute = () => {
    const parsed = parseIntent(cmdText);
    if (!parsed) {
      setCmdResult('Comando no reconocido. Usá: /recordatorio, /renovacion, /reporte, /mensaje, /mantenimiento');
      return;
    }
    setInput({ communicationType: parsed.type, additionalContext: parsed.context });
    setCmdResult(`Comando detectado: "${parsed.type}". Campos pre-cargados abajo.`);
    setCmdText('');
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* ── Command bar ── */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-black">Comandos rápidos</span>
          </div>
          <div className="flex gap-2">
            <Input
              className="flex-1 font-mono text-sm"
              placeholder="/recordatorio · /reporte · /renovacion · /mensaje · /mantenimiento"
              value={cmdText}
              onChange={e => setCmdText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCommandRoute()}
            />
            <Button size="sm" className="gap-1 bg-primary text-white" onClick={handleCommandRoute}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {cmdResult && (
            <p className={['text-[11px] font-bold px-2 py-1 rounded', cmdResult.startsWith('Comando detectado') ? 'text-green-700 bg-green-50' : 'text-orange-700 bg-orange-50'].join(' ')}>
              {cmdResult}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {COMMAND_INTENTS.map(c => (
              <button key={c.cmd} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setCmdText(c.cmd + ' ')}>
                {c.cmd}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
              <div className="p-6 bg-muted/10 rounded-lg border whitespace-pre-wrap leading-relaxed text-foreground min-h-[200px] text-justify font-body">
                {result.draftedMessage}
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-black text-muted-foreground">Email del Destinatario</Label>
                <Input
                  type="email"
                  placeholder="inquilino@ejemplo.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button className="w-full gap-2 bg-primary text-white font-bold" onClick={handleSend} disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? 'Enviando...' : 'Enviar Mensaje'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
