import { Button, Group, Modal, Stack, Table, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QueryState } from '../components/ui';
import { orNull, withToast } from '../lib';
import { useCategories, useDeleteCategory, useSaveCategory } from '../queries';
import type { Category, CategoryIn } from '../types';

const EMPTY: CategoryIn = { code: '', icon: '', name_en: '', name_ne: '' };

function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const [form, setForm] = useState<CategoryIn>(() =>
    category
      ? { code: category.code, icon: category.icon ?? '', name_en: category.name_en, name_ne: category.name_ne ?? '' }
      : EMPTY,
  );
  const set = (patch: Partial<CategoryIn>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: CategoryIn = {
      code: form.code.trim(),
      icon: orNull(form.icon),
      name_en: form.name_en.trim(),
      name_ne: orNull(form.name_ne),
    };
    if (await withToast(save.mutateAsync({ id: category?.id, body }))) onClose();
  }

  async function onDelete() {
    if (!category || !window.confirm(t('common.confirmDelete', { name: category.name_en }))) return;
    const ok = await withToast(remove.mutateAsync(category.id), t('common.deleted'));
    if (ok !== undefined) onClose();
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label={t('categories.code')}
          description={t('categories.codeHint')}
          required
          pattern="[a-z0-9_]+"
          minLength={2}
          maxLength={50}
          value={form.code}
          onChange={(e) => set({ code: e.currentTarget.value })}
        />
        <TextInput
          label={t('categories.nameEn')}
          required
          maxLength={80}
          value={form.name_en}
          onChange={(e) => set({ name_en: e.currentTarget.value })}
        />
        <TextInput
          label={t('categories.nameNe')}
          maxLength={80}
          value={form.name_ne ?? ''}
          onChange={(e) => set({ name_ne: e.currentTarget.value })}
        />
        <TextInput
          label={t('categories.icon')}
          description={t('categories.iconHint')}
          maxLength={80}
          value={form.icon ?? ''}
          onChange={(e) => set({ icon: e.currentTarget.value })}
        />
        <Group justify="space-between">
          {category ? (
            <Button color="red" variant="light" onClick={onDelete} loading={remove.isPending}>
              {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function Categories() {
  const { t } = useTranslation();
  const categories = useCategories();
  // undefined = closed, null = new, Category = editing
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);

  return (
    <>
      <PageHeader
        title={t('nav.categories')}
        right={<Button onClick={() => setEditing(null)}>{t('categories.new')}</Button>}
      />
      <QueryState query={categories}>
        {(items) => (
          <Table.ScrollContainer minWidth={560}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('categories.code')}</Table.Th>
                  <Table.Th>{t('categories.nameEn')}</Table.Th>
                  <Table.Th>{t('categories.nameNe')}</Table.Th>
                  <Table.Th>{t('categories.icon')}</Table.Th>
                  <Table.Th>{t('categories.placeCount')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((c) => (
                  <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(c)}>
                    <Table.Td>{c.code}</Table.Td>
                    <Table.Td>{c.name_en}</Table.Td>
                    <Table.Td>{c.name_ne ?? '—'}</Table.Td>
                    <Table.Td>{c.icon ?? '—'}</Table.Td>
                    <Table.Td>{c.place_count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </QueryState>
      <Modal
        opened={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? editing.name_en : t('categories.new')}
      >
        {editing !== undefined && (
          <CategoryModal
            key={editing?.id ?? 'new'}
            category={editing}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </>
  );
}
