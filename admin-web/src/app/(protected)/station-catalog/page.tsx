'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { RequireRole } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { TableShell } from '@/components/ui/table-shell';
import { Textarea } from '@/components/ui/textarea';
import { stationsClient } from '@/lib/api/stations-client';
import { useAuth } from '@/lib/auth/auth-context';
import { useDocumentTitle } from '@/lib/use-document-title';
import { ConnectorFieldsEditor } from '@/features/stations/connector-fields-editor';
import { ConnectorFormValue, connectorsFormSchema, createEmptyConnector, toConnectorFormValue } from '@/features/stations/connector-form';

const templateSchema = z.object({
  modelId: z.string().uuid('Select a model'),
  connectors: connectorsFormSchema,
});

type TemplateFormValues = z.infer<typeof templateSchema>;

export default function StationCatalogPage() {
  useDocumentTitle('Station Catalog');
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editingBrandId, setEditingBrandId] = useState('');
  const [editingModelId, setEditingModelId] = useState('');
  const brandFormRef = useRef<HTMLFormElement | null>(null);
  const modelFormRef = useRef<HTMLFormElement | null>(null);
  const stationConfig = useQuery({
    queryKey: ['station-config'],
    queryFn: () => stationsClient.getConfig(),
    enabled: isAdmin,
  });

  const brands = useMemo(
    () => [...(stationConfig.data?.data.brands ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [stationConfig.data?.data.brands],
  );
  const models = useMemo(
    () =>
      [...(stationConfig.data?.data.models ?? [])].sort((left, right) => {
        if (left.brandId !== right.brandId) {
          return left.brandId.localeCompare(right.brandId);
        }

        return left.name.localeCompare(right.name);
      }),
    [stationConfig.data?.data.models],
  );
  const brandMap = useMemo(
    () => new Map(brands.map((brand) => [brand.id, brand])),
    [brands],
  );

  const brandForm = useForm({
    defaultValues: {
      name: '',
      isActive: 'true',
    },
  });
  const modelForm = useForm({
    defaultValues: {
      brandId: '',
      name: '',
      description: '',
      imageUrl: '',
      logoUrl: '',
      isActive: 'true',
    },
  });
  const templateForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      modelId: '',
      connectors: [createEmptyConnector(1)],
    },
  });
  const templateFieldArray = useFieldArray({
    control: templateForm.control,
    name: 'connectors',
  });
  const {
    fields: templateFields,
    append: appendTemplateField,
    remove: removeTemplateField,
    replace: replaceTemplateFields,
  } = templateFieldArray;
  const selectedTemplateModelId = useWatch({ control: templateForm.control, name: 'modelId' });
  const selectedTemplateModel = useMemo(
    () => models.find((model) => model.id === selectedTemplateModelId) ?? null,
    [models, selectedTemplateModelId],
  );

  const resetBrandForm = () => {
    setEditingBrandId('');
    brandForm.reset({ name: '', isActive: 'true' });
  };

  const resetModelForm = () => {
    setEditingModelId('');
    modelForm.reset({
      brandId: '',
      name: '',
      description: '',
      imageUrl: '',
      logoUrl: '',
      isActive: 'true',
    });
  };

  const focusCard = (element: HTMLFormElement | null, fieldId: string) => {
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.requestAnimationFrame(() => {
      const field = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      field?.focus();
    });
  };

  const startBrandEdit = (brand: (typeof brands)[number]) => {
    setEditingBrandId(brand.id);
    brandForm.reset({
      name: brand.name,
      isActive: String(brand.isActive),
    });
    focusCard(brandFormRef.current, 'brand-name');
  };

  const startModelEdit = (model: (typeof models)[number]) => {
    setEditingModelId(model.id);
    modelForm.reset({
      brandId: model.brandId,
      name: model.name,
      description: model.description ?? '',
      imageUrl: model.imageUrl ?? '',
      logoUrl: model.logoUrl ?? '',
      isActive: String(model.isActive),
    });
    focusCard(modelFormRef.current, 'model-brand');
  };

  useEffect(() => {
    if (!selectedTemplateModel) {
      return;
    }

    replaceTemplateFields(
      selectedTemplateModel.latestTemplateConnectors.length > 0
        ? selectedTemplateModel.latestTemplateConnectors.map((connector) => toConnectorFormValue(connector))
        : [createEmptyConnector(1)],
    );
  }, [replaceTemplateFields, selectedTemplateModel]);

  const brandMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: { name: string; isActive: boolean } }) =>
      id ? stationsClient.updateBrand(id, payload) : stationsClient.createBrand(payload),
    onSuccess: async () => {
      resetBrandForm();
      await queryClient.invalidateQueries({ queryKey: ['station-config'] });
    },
  });
  const brandToggleMutation = useMutation({
    mutationFn: ({ id, name, isActive }: { id: string; name: string; isActive: boolean }) =>
      stationsClient.updateBrand(id, { name, isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['station-config'] });
    },
  });
  const brandDeleteMutation = useMutation({
    mutationFn: (id: string) => stationsClient.deleteBrand(id),
    onSuccess: async (_response, id) => {
      if (editingBrandId === id) {
        resetBrandForm();
      }

      await queryClient.invalidateQueries({ queryKey: ['station-config'] });
    },
  });
  const modelMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: string;
      payload: {
        brandId: string;
        name: string;
        description: string | null;
        imageUrl: string | null;
        logoUrl: string | null;
        isActive: boolean;
      };
    }) => (id ? stationsClient.updateModel(id, payload) : stationsClient.createModel(payload)),
    onSuccess: async () => {
      resetModelForm();
      await queryClient.invalidateQueries({ queryKey: ['station-config'] });
    },
  });
  const modelToggleMutation = useMutation({
    mutationFn: ({
      id,
      brandId,
      name,
      description,
      imageUrl,
      logoUrl,
      isActive,
    }: {
      id: string;
      brandId: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      logoUrl: string | null;
      isActive: boolean;
    }) =>
      stationsClient.updateModel(id, {
        brandId,
        name,
        description,
        imageUrl,
        logoUrl,
        isActive,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['station-config'] });
    },
  });
  const modelDeleteMutation = useMutation({
    mutationFn: (id: string) => stationsClient.deleteModel(id),
    onSuccess: async (_response, id) => {
      if (editingModelId === id) {
        resetModelForm();
      }

      if (selectedTemplateModelId === id) {
        templateForm.reset({
          modelId: '',
          connectors: [createEmptyConnector(1)],
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['station-config'] });
    },
  });
  const templateMutation = useMutation({
    mutationFn: (payload: { modelId: string; connectors: ConnectorFormValue[] }) =>
      stationsClient.replaceModelTemplate(
        payload.modelId,
        payload.connectors.map((connector) => ({
          connectorNo: connector.connectorNo,
          connectorType: connector.connectorType,
          currentType: connector.currentType,
          powerKw: connector.powerKw,
          sortOrder: connector.sortOrder,
          isActive: connector.isActive,
        })),
      ),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['station-config'] });
      templateForm.reset({
        modelId: response.data.id,
        connectors:
          response.data.latestTemplateConnectors.length > 0
            ? response.data.latestTemplateConnectors.map((connector) => toConnectorFormValue(connector))
            : [createEmptyConnector(1)],
      });
    },
  });

  return (
    <RequireRole roles={['admin']} title='Admin only' description='Station catalog configuration is restricted to administrators.'>
      <div className='page-stack'>
        <PageHeader
          title='Station catalog'
          description='Manage brands, models, and the latest connector templates without leaving the admin workspace.'
        />

        {stationConfig.isLoading ? <StateCard title='Loading station catalog' description='Fetching the latest brand, model, and template configuration.' /> : null}
        {stationConfig.error ? <StateCard title='Station catalog unavailable' description={(stationConfig.error as Error).message} tone='danger' /> : null}

        {!stationConfig.isLoading && !stationConfig.error ? (
          <>
            <form
              ref={brandFormRef}
              className='card page-stack'
              onSubmit={brandForm.handleSubmit(async (values) => {
                await brandMutation.mutateAsync({
                  id: editingBrandId || undefined,
                  payload: {
                    name: values.name.trim(),
                    isActive: values.isActive === 'true',
                  },
                });
              })}
            >
              <div className='stack-row' style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3>{editingBrandId ? 'Edit brand' : 'Create brand'}</h3>
                  <p className='muted'>Keep catalog brands aligned with the backend source of truth.</p>
                </div>
                {editingBrandId ? (
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={resetBrandForm}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
              <div className='form-grid'>
                <div className='field'>
                  <label htmlFor='brand-name'>Name</label>
                  <Input id='brand-name' {...brandForm.register('name', { required: true })} />
                </div>
                <div className='field'>
                  <label htmlFor='brand-active'>State</label>
                  <Select id='brand-active' {...brandForm.register('isActive')}>
                    <option value='true'>Active</option>
                    <option value='false'>Inactive</option>
                  </Select>
                </div>
              </div>
              {brandMutation.error ? <p className='form-error'>{(brandMutation.error as Error).message}</p> : null}
              <div className='section-actions'>
                <Button type='submit' disabled={brandMutation.isPending}>
                  {brandMutation.isPending ? 'Saving...' : editingBrandId ? 'Save brand' : 'Create brand'}
                </Button>
              </div>
            </form>

            <TableShell title='Brands' description='Current catalog brands used by station creation and editing flows.'>
              <div className='table-wrap'>
                <table className='table'>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>State</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((brand) => (
                      <tr key={brand.id}>
                        <td>{brand.name}</td>
                        <td><Badge tone={brand.isActive ? 'success' : 'warning'}>{brand.isActive ? 'Active' : 'Inactive'}</Badge></td>
                        <td>{brand.updatedAt}</td>
                        <td>
                          <div className='table-actions'>
                            <Button
                              type='button'
                              variant='secondary'
                              onClick={() => startBrandEdit(brand)}
                            >
                              Edit
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              onClick={() => brandToggleMutation.mutate({
                                id: brand.id,
                                name: brand.name,
                                isActive: !brand.isActive,
                              })}
                              disabled={brandToggleMutation.isPending}
                            >
                              {brand.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <ConfirmButton
                              label='Delete'
                              variant='danger'
                              disabled={brandDeleteMutation.isPending}
                              confirmText={`Delete brand "${brand.name}"? This also removes unused models under this brand. Brands linked to stations cannot be deleted.`}
                              onConfirm={() => {
                                brandDeleteMutation.mutate(brand.id);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {brandToggleMutation.error ? <p className='form-error'>{(brandToggleMutation.error as Error).message}</p> : null}
              {brandDeleteMutation.error ? <p className='form-error'>{(brandDeleteMutation.error as Error).message}</p> : null}
            </TableShell>

            <form
              ref={modelFormRef}
              className='card page-stack'
              onSubmit={modelForm.handleSubmit(async (values) => {
                await modelMutation.mutateAsync({
                  id: editingModelId || undefined,
                  payload: {
                    brandId: values.brandId,
                    name: values.name.trim(),
                    description: values.description.trim() ? values.description : null,
                    imageUrl: values.imageUrl.trim() ? values.imageUrl : null,
                    logoUrl: values.logoUrl.trim() ? values.logoUrl : null,
                    isActive: values.isActive === 'true',
                  },
                });
              })}
            >
              <div className='stack-row' style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3>{editingModelId ? 'Edit model' : 'Create model'}</h3>
                  <p className='muted'>Store model media, descriptions, and brand relationships for station forms and detail pages.</p>
                </div>
                {editingModelId ? (
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={resetModelForm}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
              <div className='form-grid'>
                <div className='field'>
                  <label htmlFor='model-brand'>Brand</label>
                  <Select id='model-brand' {...modelForm.register('brandId', { required: true })}>
                    <option value=''>Select a brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}{brand.isActive ? '' : ' (Inactive)'}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className='field'>
                  <label htmlFor='model-name'>Name</label>
                  <Input id='model-name' {...modelForm.register('name', { required: true })} />
                </div>
                <div className='field'>
                  <label htmlFor='model-image'>Image URL</label>
                  <Input id='model-image' {...modelForm.register('imageUrl')} />
                </div>
                <div className='field'>
                  <label htmlFor='model-logo'>Logo URL</label>
                  <Input id='model-logo' {...modelForm.register('logoUrl')} />
                </div>
                <div className='field'>
                  <label htmlFor='model-active'>State</label>
                  <Select id='model-active' {...modelForm.register('isActive')}>
                    <option value='true'>Active</option>
                    <option value='false'>Inactive</option>
                  </Select>
                </div>
              </div>
              <div className='field'>
                <label htmlFor='model-description'>Description</label>
                <Textarea id='model-description' {...modelForm.register('description')} placeholder='Internal notes or operator-facing description' />
              </div>
              {modelMutation.error ? <p className='form-error'>{(modelMutation.error as Error).message}</p> : null}
              <div className='section-actions'>
                <Button type='submit' disabled={modelMutation.isPending}>
                  {modelMutation.isPending ? 'Saving...' : editingModelId ? 'Save model' : 'Create model'}
                </Button>
              </div>
            </form>

            <TableShell title='Models' description='Catalog models that drive station selection, media, and template-backed connector defaults.'>
              <div className='table-wrap'>
                <table className='table'>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Brand</th>
                      <th>Template</th>
                      <th>State</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.id}>
                        <td>
                          <div className='list'>
                            <strong>{model.name}</strong>
                            <span className='muted'>{model.description || 'No description stored.'}</span>
                          </div>
                        </td>
                        <td>{brandMap.get(model.brandId)?.name ?? 'Unknown brand'}</td>
                        <td>
                          <div className='list'>
                            <div>{model.latestTemplateVersion ? `v${model.latestTemplateVersion}` : 'No template'}</div>
                            <div className='muted'>{model.latestTemplateConnectors.length} connector rows</div>
                          </div>
                        </td>
                        <td><Badge tone={model.isActive ? 'success' : 'warning'}>{model.isActive ? 'Active' : 'Inactive'}</Badge></td>
                        <td>
                          <div className='table-actions'>
                            <Button
                              type='button'
                              variant='secondary'
                              onClick={() => startModelEdit(model)}
                            >
                              Edit
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              onClick={() => modelToggleMutation.mutate({
                                id: model.id,
                                brandId: model.brandId,
                                name: model.name,
                                description: model.description,
                                imageUrl: model.imageUrl,
                                logoUrl: model.logoUrl,
                                isActive: !model.isActive,
                              })}
                              disabled={modelToggleMutation.isPending}
                            >
                              {model.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <ConfirmButton
                              label='Delete'
                              variant='danger'
                              disabled={modelDeleteMutation.isPending}
                              confirmText={`Delete model "${model.name}"? Its latest connector template will also be removed. Models linked to stations cannot be deleted.`}
                              onConfirm={() => {
                                modelDeleteMutation.mutate(model.id);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {modelToggleMutation.error ? <p className='form-error'>{(modelToggleMutation.error as Error).message}</p> : null}
              {modelDeleteMutation.error ? <p className='form-error'>{(modelDeleteMutation.error as Error).message}</p> : null}
            </TableShell>

            <form
              className='card page-stack'
              onSubmit={templateForm.handleSubmit(async (values) => {
                await templateMutation.mutateAsync(values);
              })}
            >
              <div>
                <h3>Model connector template</h3>
                <p className='muted'>Replace the latest connector template snapshot for a model. Existing station connectors are not changed until operators apply the template on a station.</p>
              </div>
              <div className='form-grid'>
                <div className='field'>
                  <label htmlFor='template-model'>Model</label>
                  <Select id='template-model' {...templateForm.register('modelId')}>
                    <option value=''>Select a model</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {(brandMap.get(model.brandId)?.name ?? 'Unknown brand')} · {model.name}
                      </option>
                    ))}
                  </Select>
                  {templateForm.formState.errors.modelId ? <p className='form-error'>{templateForm.formState.errors.modelId.message}</p> : null}
                </div>
              </div>

              {selectedTemplateModel ? (
                <div className='subtle-box page-stack'>
                  <div className='inline-cluster'>
                    <Badge tone={selectedTemplateModel.isActive ? 'success' : 'warning'}>
                      {selectedTemplateModel.isActive ? 'Active model' : 'Inactive model'}
                    </Badge>
                    <Badge>
                      {selectedTemplateModel.latestTemplateVersion ? `Current v${selectedTemplateModel.latestTemplateVersion}` : 'No template yet'}
                    </Badge>
                  </div>
                  <p className='muted'>{selectedTemplateModel.description || 'No model description stored.'}</p>
                </div>
              ) : null}

              <ConnectorFieldsEditor
                fields={templateFields}
                register={templateForm.register}
                append={appendTemplateField}
                remove={removeTemplateField}
                errors={templateForm.formState.errors}
                disabled={templateMutation.isPending}
                title='Template connectors'
                description='These rows will become the latest template snapshot for the selected model.'
              />

              {templateMutation.error ? <p className='form-error'>{(templateMutation.error as Error).message}</p> : null}
              <div className='section-actions'>
                <Button type='submit' disabled={templateMutation.isPending}>
                  {templateMutation.isPending ? 'Replacing template...' : 'Replace latest template'}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </RequireRole>
  );
}
