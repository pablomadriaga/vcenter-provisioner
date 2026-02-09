# Buenas Prácticas de React para Campos de Ingreso de Datos

## 1. Evitar Re-Renderizados Innecesarios

### ✅ CORRECTO: Usar React.memo
```tsx
const TextFieldWrapper = memo(({ value, onChange, placeholder }) => {
    return (
        <TextField
            value={value}
            onChange={onChange}
            placeholder={placeholder}
        />
    );
});

TextFieldWrapper.displayName = 'TextFieldWrapper';
```

### ❌ INCORRECTO: Sin memoización
```tsx
const TextFieldWrapper = ({ value, onChange, placeholder }) => {
    return (
        <TextField
            value={value}
            onChange={onChange}
            placeholder={placeholder}
        />
    );
};
```

---

## 2. Separar Componentes Especializados

### ✅ CORRECTO: Componente separado
```tsx
// SegmentEditor.tsx
const SegmentEditor = memo(({ segment, onTypeChange, onValueChange }) => {
    return (
        <TextField
            value={segment.value}
            onChange={onValueChange}
        />
    );
});

// TypificationsPage.tsx
{segments.map(seg => (
    <SegmentEditor key={seg.id} segment={seg} />
))}
```

### ❌ INCORRECTO: Componente anidado
```tsx
const Step2Content = () => {
    const renderSegments = segments.map((seg, index) => {
        return (
            <TextField
                key={index}
                value={seg.value}
                onChange={(e) => updateSegment(index, 'value', e.target.value)}
            />
        );
    });
    return <div>{renderSegments}</div>;
};
```

---

## 3. Usar Keys Estables

### ✅ CORRECTO: IDs únicos
```tsx
{segments.map(seg => (
    <SegmentEditor key={seg.id} segment={seg} />
))}
```

### ❌ INCORRECTO: Índices como keys
```tsx
{segments.map((seg, index) => (
    <SegmentEditor key={index} segment={seg} />
))}
```

---

## 4. No Crear Componentes Dentro de Otros

### ✅ CORRECTO: Componente externo
```tsx
const Card = memo(({ item }) => <div>{item.name}</div>);

const List = ({ items }) => {
    return items.map(item => <Card key={item.id} item={item} />);
};
```

### ❌ INCORRECTO: Componente dentro de render
```tsx
const List = ({ items }) => {
    const Card = memo(({ item }) => <div>{item.name}</div>); // ❌
    
    return items.map(item => <Card key={item.id} item={item} />);
};
```

---

## 5. Usar useCallback Correctamente

### ✅ CORRECTO: Callback estable
```tsx
const handleChange = useCallback((value) => {
    onChange(value);
}, [onChange]);

<TextField onChange={handleChange} />
```

### ❌ INCORRECTO: Callback recreado
```tsx
const handleChange = (value) => {
    onChange(value); // ❌ Se recrea cada render
};

<TextField onChange={handleChange} />
```

---

## 6. Evitar Actualizar State Durante Renders

### ✅ CORRECTO: Control inputs con estado local
```tsx
const [localValue, setLocalValue] = useState(initialValue);

const handleChange = (e) => {
    setLocalValue(e.target.value);
};

const handleBlur = () => {
    onChange(localValue);
};

<TextField
    value={localValue}
    onChange={handleChange}
    onBlur={handleBlur}
/>
```

### ❌ INCORRECTO: Actualizar state directamente en onChange
```tsx
const handleChange = (e) => {
    setItems(items.map(...)); // ❌ Puede causar re-renders
};

<TextField onChange={handleChange} />
```

---

## 7. Evitar Prop Drilling Excesivo

### ✅ CORRECTO: Componente con responsabilidad única
```tsx
const SegmentEditor = memo(({ segment, onUpdate }) => {
    const handleTypeChange = (value) => {
        onUpdate(segment.id, 'type', value);
    };
    
    return (
        <Select onChange={handleTypeChange} value={segment.type} />
    );
});
```

### ❌ INCORRECTO: Pasar muchas props sin necesidad
```tsx
const SegmentEditor = memo(({
    segment,
    updateSegment,
    removeSegment,
    segments,
    setSegments,
    // ❌ Demasiadas props
}) => {
    return (
        <Select onChange={(e) => updateSegment(index, 'type', e.target.value)} />
    );
});
```

---

## 8. Usar Componentes Controlados

### ✅ CORRECTO: Componente controlado
```tsx
const [value, setValue] = useState('');

<TextField
    value={value}
    onChange={(e) => setValue(e.target.value)}
/>
```

### ❌ INCORRECTO: Componente no controlado
```tsx
<TextField
    defaultValue={value} // ❌ No hay control del estado
/>
```

---

## 9. Evitar Efectos Secundarios Durante Render

### ✅ CORRECTO: Usar useEffect
```tsx
useEffect(() => {
    if (value.length > 0) {
        validate(value);
    }
}, [value]);
```

### ❌ INCORRECTO: Lógica durante render
```tsx
const Component = ({ value }) => {
    if (value.length > 0) {
        validate(value); // ❌ Se ejecuta en cada render
    }
    
    return <TextField value={value} />;
};
```

---

## 10. Lazy Loading Para Listas Grandes

### ✅ CORRECTO: Usar React.lazy
```tsx
import { lazy, Suspense } from 'react';

const HeavySegmentEditor = lazy(() => import('./SegmentEditor'));

{segments.map(seg => (
    <Suspense fallback={<Loading />}>
        <HeavySegmentEditor key={seg.id} segment={seg} />
    </Suspense>
))}
```

### ❌ INCORRECTO: Importar todo directamente
```tsx
import HeavySegmentEditor from './SegmentEditor';

{segments.map(seg => (
    <HeavySegmentEditor key={seg.id} segment={seg} />
))}
```

---

## 11. Usar useMemo Para Cálculos Costosos

### ✅ CORRECTO: Memoizar cálculos
```tsx
const filteredSegments = useMemo(() => {
    return segments.filter(seg => seg.type !== 'deleted');
}, [segments]);
```

### ❌ INCORRECTO: Calcular en cada render
```tsx
const filteredSegments = segments.filter(seg => seg.type !== 'deleted');
```

---

## 12. Validación En Tiempo Real

### ✅ CORRECTO: Validar con debounce
```tsx
import { useDebouncedCallback } from 'use-debounce';

const handleChange = useDebouncedCallback((value) => {
    validate(value);
}, 300);

<TextField onChange={handleChange} />
```

### ❌ INCORRECTO: Validar en cada tecla
```tsx
const handleChange = (e) => {
    validate(e.target.value); // ❌ Demasiadas validaciones
};
```

---

## 13. Accesibilidad en Campos de Formulario

### ✅ CORRECTO: Label asociado
```tsx
<TextField
    id="email"
    label="Email"
    aria-label="Correo electrónico"
    autoComplete="email"
    required
/>
```

### ❌ INCORRECTO: Sin label
```tsx
<TextField
    placeholder="Email" // ❌ No accesible
/>
```

---

## 14. Gestión de Errores en Campos

### ✅ CORRECTO: Mostrar errores claros
```tsx
<TextField
    value={value}
    onChange={onChange}
    error={!!error}
    helperText={error}
    InputProps={{
        'aria-invalid': !!error,
        'aria-describedby': error ? 'error-text' : undefined
    }}
/>
{error && <p id="error-text">{error}</p>}
```

### ❌ INCORRECTO: Mensajes genéricos
```tsx
<TextField
    value={value}
    onChange={onChange}
    helperText="Error" // ❌ Mensaje genérico
/>
```

---

## 15. Performance en Listas de Campos

### ✅ CORRECTO: Virtualización para listas grandes
```tsx
import { FixedSizeList } from 'react-window';

const Row = ({ index, style, data }) => (
    <div style={style}>
        <TextField value={data[index].value} />
    </div>
);

<FixedSizeList
    height={600}
    itemCount={items.length}
    itemSize={100}
    itemData={items}
>
    {Row}
</FixedSizeList>
```

### ❌ INCORRECTO: Renderizar todos los campos
```tsx
{items.map((item, index) => (
    <TextField key={index} value={item.value} />
))}
```

---

## Checklist de Buenas Prácticas

- [ ] Usar React.memo para componentes memoizables
- [ ] Separar componentes en archivos dedicados
- [ ] Usar keys estables (IDs únicos)
- [ ] No crear componentes dentro de otros componentes
- [ ] Usar useCallback para callbacks pasados a hijos
- [ ] Evitar actualizar state durante renders
- [ ] Usar componentes controlados
- [ ] Evitar prop drilling excesivo
- [ ] Usar useEffect para efectos secundarios
- [ ] Implementar lazy loading para componentes pesados
- [ ] Usar useMemo para cálculos costosos
- [ ] Implementar validación con debounce
- [ ] Asegurar accesibilidad (labels, ARIA)
- [ ] Proporcionar mensajes de error claros
- [ ] Usar virtualización para listas grandes

---

## Resumen del TextField Focus Issue en vCenter Provisioner

### Problema Identificado
El componente `Step2Content` en `TypificationsPage.tsx` tenía los siguientes problemas:

1. **Componentes anidados**: Los TextField se renderizaban dentro del map
2. **Keys inestables**: Se usaban índices como keys
3. **Re-renders**: El componente se recreaba al cambiar `segments`
4. **Callbacks sin memoización**: Los callbacks causaban re-renders

### Solución Implementada

1. **Componente separado**: Crear `SegmentEditor.tsx` con React.memo
2. **Keys estables**: Asignar IDs únicos a cada segmento
3. **Componentes memoizados**: Usar memo para evitar re-renders
4. **Callbacks estables**: Usar useCallback con IDs únicos

### Resultado
- ✅ Los TextField mantienen el foco al escribir
- ✅ No hay re-renders innecesarios
- ✅ Mejor performance
- ✅ Código más mantenible
