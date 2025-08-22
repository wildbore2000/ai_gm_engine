import { useRef, useState, useCallback } from "react";

// Lazy load validation dependencies
let ajvInstance: any = null;
let validators: Record<string, any> = {};

async function getAjv() {
  if (!ajvInstance) {
    const [Ajv2020, addFormats] = await Promise.all([
      import("ajv/dist/2020"),
      import("ajv-formats")
    ]);
    
    ajvInstance = new Ajv2020.default({ allErrors: true, strict: false });
    addFormats.default(ajvInstance);
  }
  return ajvInstance;
}

// Minimal schema definitions (loaded on demand)
const schemas = {
  entity: () => ({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "schema/entity.json",
    title: "Entity",
    type: "object",
    required: ["id", "name", "tags", "srd"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      srd: {
        type: "object",
        properties: {
          level: { type: "integer" },
          ancestry: { type: "string" },
          role: { type: "string" },
          stats: {
            type: "object",
            properties: {
              str: { type: "integer" },
              dex: { type: "integer" },
              con: { type: "integer" },
              int: { type: "integer" },
              wis: { type: "integer" },
              cha: { type: "integer" }
            }
          },
          hp: { type: "integer" },
          ac: { type: "integer" }
        }
      }
    }
  }),
  
  faction: () => ({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "schema/faction.json",
    title: "Faction",
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      goals: { type: "array", items: { type: "string" } },
      pressure: { type: "number", minimum: 0, maximum: 1 },
      stability: { type: "number", minimum: 0, maximum: 1 }
    }
  })
};

async function getValidator(schemaType: keyof typeof schemas) {
  if (!validators[schemaType]) {
    const ajv = await getAjv();
    const schema = schemas[schemaType]();
    validators[schemaType] = ajv.compile(schema);
  }
  return validators[schemaType];
}

export async function validateEntity(data: any): Promise<{ isValid: boolean; errors: string[] }> {
  try {
    const validator = await getValidator('entity');
    const isValid = validator(data);
    const errors = validator.errors?.map((e: any) => `${e.instancePath || "/"} ${e.message}`) || [];
    return { isValid, errors };
  } catch (error) {
    return { isValid: false, errors: ['Validation failed'] };
  }
}

export async function validateFaction(data: any): Promise<{ isValid: boolean; errors: string[] }> {
  try {
    const validator = await getValidator('faction');
    const isValid = validator(data);
    const errors = validator.errors?.map((e: any) => `${e.instancePath || "/"} ${e.message}`) || [];
    return { isValid, errors };
  } catch (error) {
    return { isValid: false, errors: ['Validation failed'] };
  }
}

export function download(filename: string, data: object) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useAsyncValidation<T>(
  initial: T, 
  validateFn: (data: any) => Promise<{ isValid: boolean; errors: string[] }>
) {
  const [data, setData] = useState<T>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(async (value?: T) => {
    const dataToValidate = value !== undefined ? value : data;
    setIsValidating(true);
    
    try {
      const result = await validateFn(dataToValidate);
      setErrors(result.errors);
      return result.isValid;
    } catch (error) {
      setErrors(['Validation error occurred']);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [data, validateFn]);

  const updateData = useCallback((newData: T) => {
    setData(newData);
    setErrors([]); // Clear errors on data change
  }, []);

  return {
    data,
    errors,
    isValidating,
    updateData,
    validate
  };
}

// Optimized JSON editor hook
export function useOptimizedJsonEditor<T>(
  initial: T,
  validateFn: (data: any) => Promise<{ isValid: boolean; errors: string[] }>
) {
  const [raw, setRaw] = useState<string>(() => JSON.stringify(initial, null, 2));
  const [parsed, setParsed] = useState<T>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const validateTimeoutRef = useRef<NodeJS.Timeout>();

  const debouncedValidate = useCallback(async (text: string) => {
    if (validateTimeoutRef.current) {
      clearTimeout(validateTimeoutRef.current);
    }

    validateTimeoutRef.current = setTimeout(async () => {
      try {
        const obj = JSON.parse(text);
        setIsValidating(true);
        const result = await validateFn(obj);
        
        if (result.isValid) {
          setParsed(obj);
          setErrors([]);
        } else {
          setErrors(result.errors);
        }
      } catch (e: any) {
        setErrors([e.message]);
      } finally {
        setIsValidating(false);
      }
    }, 500); // 500ms debounce
  }, [validateFn]);

  const updateRaw = useCallback((text: string) => {
    setRaw(text);
    debouncedValidate(text);
  }, [debouncedValidate]);

  const uploadRef = useRef<HTMLInputElement>(null);
  const onUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    file.text().then((text) => {
      updateRaw(text);
    });
  }, [updateRaw]);

  return { 
    raw, 
    updateRaw, 
    parsed, 
    errors, 
    isValidating,
    uploadRef, 
    onUpload 
  };
}