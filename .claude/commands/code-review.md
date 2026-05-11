# Code Review — AlquilaGestión Pro

Realizá una revisión exhaustiva del código indicado (o del diff actual si no se especifica archivo). Usá este checklist adaptado al stack del proyecto: Next.js 14, TypeScript, Firebase Firestore, shadcn/ui, Tailwind CSS.

## 1. Seguridad (crítico)

- [ ] **Firestore rules**: ¿los writes están protegidos por userId? ¿hay acceso anónimo no intencional?
- [ ] **Variables de entorno**: ¿hay keys hardcodeadas? Verificar que no haya `FIREBASE_`, `RESEND_`, `STRIPE_` en el código
- [ ] **Inputs del usuario**: ¿se sanitizan antes de escribir a Firestore?
- [ ] **XSS**: ¿se usa `dangerouslySetInnerHTML` sin sanitizar?
- [ ] **IDOR**: ¿las rutas de API validan que el userId del token coincida con el recurso solicitado?

```bash
grep -rn "dangerouslySetInnerHTML\|eval\|innerHTML" src/
grep -rn "FIREBASE_\|RESEND_\|STRIPE_\|SECRET" src/ --include="*.ts" --include="*.tsx"
```

## 2. Correctness

- [ ] **Null/undefined**: ¿se manejan los casos donde Firestore devuelve `undefined`?
- [ ] **Fechas**: ¿se usan `Timestamp` de Firestore correctamente? ¿hay conversiones `toDate()` faltantes?
- [ ] **Race conditions**: ¿hay `useEffect` con dependencias faltantes o doble-fire en StrictMode?
- [ ] **Estados de loading/error**: ¿todos los async calls tienen manejo de error visible al usuario?
- [ ] **TypeScript**: ¿hay `any` innecesarios o casteos forzados con `as`?

## 3. Performance

- [ ] **Re-renders**: ¿los `useMemo`/`useCallback` tienen dependencias correctas?
- [ ] **Firestore queries**: ¿hay queries dentro de loops (N+1)?
- [ ] **Bundle size**: ¿se importan librerías pesadas completas en lugar de tree-shake?
- [ ] **Imágenes**: ¿se usa `next/image` con dimensiones correctas?

## 4. Mantenibilidad

- [ ] **Componentes**: ¿algún componente supera 300 líneas sin justificación?
- [ ] **Duplicación**: ¿hay lógica repetida que debería ir en un hook o util?
- [ ] **Nombres**: ¿las variables y funciones son descriptivas en el contexto del negocio (contratos, inquilinos, propietarios)?
- [ ] **Dead code**: ¿hay imports, variables o funciones sin usar?

## 5. UI/UX (específico del proyecto)

- [ ] **Estados vacíos**: ¿las listas muestran `EmptyState` cuando no hay datos?
- [ ] **Loading states**: ¿hay skeleton o spinner mientras cargan los datos de Firestore?
- [ ] **Responsive**: ¿funciona en mobile (375px)?
- [ ] **Dark mode**: ¿se usan tokens del design system (`text-foreground`, `bg-background`) en lugar de colores hardcodeados?
- [ ] **Accesibilidad**: ¿los botones icon-only tienen `aria-label`?

## Formato de respuesta

```
## Code Review: [archivo o feature]

### Problemas críticos
1. **[Problema]** (línea X): descripción
   - Impacto: qué puede salir mal
   - Fix: solución sugerida

### Mejoras sugeridas
1. **[Sugerencia]** (línea X): descripción

### Lo que está bien
- [qué funciona correctamente]

### Veredicto
[ ] Listo para mergear
[ ] Cambios menores necesarios  
[ ] Revisión mayor necesaria
```
