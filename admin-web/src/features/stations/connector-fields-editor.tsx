'use client';

import { FieldErrors, Path, UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConnectorFormValue, connectorTypeOptions, createEmptyConnector, currentTypeOptions } from './connector-form';

type ConnectorError = {
  connectorNo?: { message?: string };
  connectorType?: { message?: string };
  currentType?: { message?: string };
  powerKw?: { message?: string };
  sortOrder?: { message?: string };
  isActive?: { message?: string };
};

type ConnectorFormShape = {
  connectors: ConnectorFormValue[];
};

export function ConnectorFieldsEditor<TFormValues extends ConnectorFormShape>({
  fields,
  register,
  append,
  remove,
  errors,
  disabled = false,
  title = 'Connectors',
  description = 'Connector rows are the writable source of truth for this station or template.',
}: {
  fields: Array<ConnectorFormValue & { id: string }>;
  register: UseFormRegister<TFormValues>;
  append: (value: ConnectorFormValue) => void;
  remove: (index: number) => void;
  errors?: FieldErrors<TFormValues>;
  disabled?: boolean;
  title?: string;
  description?: string;
}) {
  const connectorErrors = Array.isArray(errors?.connectors) ? (errors?.connectors as ConnectorError[]) : [];
  const rootError =
    errors?.connectors && !Array.isArray(errors.connectors) && 'message' in errors.connectors
      ? String(errors.connectors.message ?? '')
      : '';
  const nextConnectorNo = fields.reduce((maxValue, field) => Math.max(maxValue, Number(field.connectorNo) || 0), 0) + 1;

  return (
    <section className='form-section'>
      <div className='stack-row' style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>{title}</h3>
          <p className='muted'>{description}</p>
        </div>
        <Button
          type='button'
          variant='secondary'
          disabled={disabled}
          onClick={() => append(createEmptyConnector(nextConnectorNo))}
        >
          Add connector
        </Button>
      </div>

      {rootError ? <p className='form-error'>{rootError}</p> : null}

      {fields.length === 0 ? (
        <div className='subtle-box page-stack'>
          <p className='muted'>No connectors added yet.</p>
          <div>
            <Button
              type='button'
              variant='secondary'
              disabled={disabled}
              onClick={() => append(createEmptyConnector(1))}
            >
              Start with connector 1
            </Button>
          </div>
        </div>
      ) : (
        <div className='connector-editor-list'>
          {fields.map((field, index) => {
            const fieldError = connectorErrors[index] ?? {};
            const connectorNoName = `connectors.${index}.connectorNo` as Path<TFormValues>;
            const connectorTypeName = `connectors.${index}.connectorType` as Path<TFormValues>;
            const currentTypeName = `connectors.${index}.currentType` as Path<TFormValues>;
            const powerKwName = `connectors.${index}.powerKw` as Path<TFormValues>;
            const sortOrderName = `connectors.${index}.sortOrder` as Path<TFormValues>;
            const isActiveName = `connectors.${index}.isActive` as Path<TFormValues>;

            return (
              <div key={field.id} className='subtle-box connector-card'>
                <div className='stack-row' style={{ justifyContent: 'space-between' }}>
                  <div className='inline-cluster'>
                    <strong>Connector {index + 1}</strong>
                    <Badge tone={field.isActive ? 'success' : 'warning'}>
                      {field.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    disabled={disabled}
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>

                <div className='form-grid'>
                  <div className='field'>
                    <label htmlFor={`connectors.${index}.connectorNo`}>Connector no</label>
                    <Input
                      id={`connectors.${index}.connectorNo`}
                      type='number'
                      min={1}
                      {...register(connectorNoName, { valueAsNumber: true })}
                    />
                    {fieldError.connectorNo?.message ? <p className='form-error'>{fieldError.connectorNo.message}</p> : null}
                  </div>

                  <div className='field'>
                    <label htmlFor={`connectors.${index}.connectorType`}>Connector type</label>
                    <Select id={`connectors.${index}.connectorType`} {...register(connectorTypeName)}>
                      {connectorTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                    {fieldError.connectorType?.message ? <p className='form-error'>{fieldError.connectorType.message}</p> : null}
                  </div>

                  <div className='field'>
                    <label htmlFor={`connectors.${index}.currentType`}>Current type</label>
                    <Select id={`connectors.${index}.currentType`} {...register(currentTypeName)}>
                      {currentTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                    {fieldError.currentType?.message ? <p className='form-error'>{fieldError.currentType.message}</p> : null}
                  </div>

                  <div className='field'>
                    <label htmlFor={`connectors.${index}.powerKw`}>Power (kW)</label>
                    <Input
                      id={`connectors.${index}.powerKw`}
                      type='number'
                      min={0}
                      step='0.1'
                      {...register(powerKwName, { valueAsNumber: true })}
                    />
                    {fieldError.powerKw?.message ? <p className='form-error'>{fieldError.powerKw.message}</p> : null}
                  </div>

                  <div className='field'>
                    <label htmlFor={`connectors.${index}.sortOrder`}>Sort order</label>
                    <Input
                      id={`connectors.${index}.sortOrder`}
                      type='number'
                      min={1}
                      {...register(sortOrderName, { valueAsNumber: true })}
                    />
                    {fieldError.sortOrder?.message ? <p className='form-error'>{fieldError.sortOrder.message}</p> : null}
                  </div>

                  <div className='field'>
                    <label htmlFor={`connectors.${index}.isActive`}>State</label>
                    <Select
                      id={`connectors.${index}.isActive`}
                      {...register(isActiveName, {
                        setValueAs: (value) => value === true || value === 'true',
                      })}
                    >
                      <option value='true'>Active</option>
                      <option value='false'>Inactive</option>
                    </Select>
                    {fieldError.isActive?.message ? <p className='form-error'>{fieldError.isActive.message}</p> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
