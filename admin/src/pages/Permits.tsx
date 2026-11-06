import { Button, Group, Modal, NumberInput, Stack, Table, Textarea, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QueryState } from '../components/ui';
import { numOrNull, orNull, withToast } from '../lib';
import { useDeletePermit, usePermits, useSavePermit } from '../queries';
import type { Permit, PermitIn } from '../types';

const EMPTY: PermitIn = {
  code: '',
  fee_nepali_npr: null,
  fee_saarc_npr: null,
  fee_foreign_npr: null,
  name_en: '',
  description_en: '',
  name_ne: '',
  description_ne: '',
};

const npr = (n: number | null) => (n == null ? '—' : `Rs ${n.toLocaleString()}`);

function PermitModal({ permit, onClose }: { permit: Permit | null; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useSavePermit();
  const remove = useDeletePermit();
  const [form, setForm] = useState<PermitIn>(() => {
    if (!permit) return EMPTY;
    const { id: _id, trek_count: _n, ...rest } = permit;
    return rest;
  });
  const set = (patch: Partial<PermitIn>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: PermitIn = {
      ...form,
      code: form.code.trim().toUpperCase(),
      name_en: form.name_en.trim(),
      name_ne: orNull(form.name_ne),
      description_en: orNull(form.description_en),
      description_ne: orNull(form.description_ne),
    };
    if (await withToast(save.mutateAsync({ id: permit?.id, body }))) onClose();
  }

  async function onDelete() {
    if (!permit || !window.confirm(t('common.confirmDelete', { name: permit.code }))) return;
    const ok = await withToast(remove.mutateAsync(permit.id), t('common.deleted'));
    if (ok !== undefined) onClose();
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label={t('permits.code')}
          description={t('permits.codeHint')}
          required
          minLength={2}
          maxLength={30}
          value={form.code}
          onChange={(e) => set({ code: e.currentTarget.value.toUpperCase() })}
        />
        <TextInput
          label={t('permits.nameEn')}
          required
          value={form.name_en}
          onChange={(e) => set({ name_en: e.currentTarget.value })}
        />
        <TextInput
          label={t('permits.nameNe')}
          value={form.name_ne ?? ''}
          onChange={(e) => set({ name_ne: e.currentTarget.value })}
        />
        <Group grow>
          <NumberInput
            label={t('permits.feeNepali')}
            min={0}
            allowDecimal={false}
            value={form.fee_nepali_npr ?? ''}
            onChange={(v) => set({ fee_nepali_npr: numOrNull(v) })}
          />
          <NumberInput
            label={t('permits.feeSaarc')}
            min={0}
            allowDecimal={false}
            value={form.fee_saarc_npr ?? ''}
            onChange={(v) => set({ fee_saarc_npr: numOrNull(v) })}
          />
          <NumberInput
            label={t('permits.feeForeign')}
            min={0}
            allowDecimal={false}
            value={form.fee_foreign_npr ?? ''}
            onChange={(v) => set({ fee_foreign_npr: numOrNull(v) })}
          />
        </Group>
        <Textarea
          label={t('permits.descriptionEn')}
          autosize
          minRows={2}
          value={form.description_en ?? ''}
          onChange={(e) => set({ description_en: e.currentTarget.value })}
        />
        <Textarea
          label={t('permits.descriptionNe')}
          autosize
          minRows={2}
          value={form.description_ne ?? ''}
          onChange={(e) => set({ description_ne: e.currentTarget.value })}
        />
        <Group justify="space-between">
          {permit ? (
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

export default function Permits() {
  const { t, i18n } = useTranslation();
  const permits = usePermits();
  const [editing, setEditing] = useState<Permit | null | undefined>(undefined);
  const ne = i18n.language.startsWith('ne');

  return (
    <>
      <PageHeader
        title={t('nav.permits')}
        right={<Button onClick={() => setEditing(null)}>{t('permits.new')}</Button>}
      />
      <QueryState query={permits}>
        {(items) => (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('permits.code')}</Table.Th>
                  <Table.Th>{t('permits.nameEn')}</Table.Th>
                  <Table.Th>{t('permits.feeNepali')}</Table.Th>
                  <Table.Th>{t('permits.feeSaarc')}</Table.Th>
                  <Table.Th>{t('permits.feeForeign')}</Table.Th>
                  <Table.Th>{t('permits.trekCount')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((p) => (
                  <Table.Tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(p)}>
                    <Table.Td>{p.code}</Table.Td>
                    <Table.Td>{(ne && p.name_ne) || p.name_en}</Table.Td>
                    <Table.Td>{npr(p.fee_nepali_npr)}</Table.Td>
                    <Table.Td>{npr(p.fee_saarc_npr)}</Table.Td>
                    <Table.Td>{npr(p.fee_foreign_npr)}</Table.Td>
                    <Table.Td>{p.trek_count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </QueryState>
      <Modal
        size="lg"
        opened={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? editing.code : t('permits.new')}
      >
        {editing !== undefined && (
          <PermitModal
            key={editing?.id ?? 'new'}
            permit={editing}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </>
  );
}
