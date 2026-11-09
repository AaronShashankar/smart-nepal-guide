import {
  Badge,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader, QueryState } from '../components/ui';
import { orNull, withToast } from '../lib';
import { useAllPlaces, useDeleteTeahouse, useSaveTeahouse, useTeahouses } from '../queries';
import type { Teahouse, TeahouseIn } from '../types';

const EMPTY: TeahouseIn = {
  place_id: '',
  name_en: '',
  name_ne: '',
  phone: '',
  price_note_en: '',
  price_note_ne: '',
  has_wifi: null,
  has_hot_shower: null,
  source: '',
};

type Tri = 'yes' | 'no' | 'unknown';
const toTri = (v: boolean | null): Tri => (v == null ? 'unknown' : v ? 'yes' : 'no');
const fromTri = (v: string): boolean | null => (v === 'unknown' ? null : v === 'yes');

function YesNoUnknown({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <SegmentedControl
        value={toTri(value)}
        onChange={(v) => onChange(fromTri(v))}
        data={[
          { value: 'yes', label: t('common.yes') },
          { value: 'no', label: t('common.no') },
          { value: 'unknown', label: t('teahouses.unknown') },
        ]}
      />
    </Stack>
  );
}

function TeahouseModal({ house, onClose }: { house: Teahouse | null; onClose: () => void }) {
  const { t } = useTranslation();
  const places = useAllPlaces();
  const save = useSaveTeahouse();
  const remove = useDeleteTeahouse();
  const [form, setForm] = useState<TeahouseIn>(() => {
    if (!house) return EMPTY;
    const { id: _id, place_name: _p, updated_at: _u, ...rest } = house;
    return rest;
  });
  const set = (patch: Partial<TeahouseIn>) => setForm((f) => ({ ...f, ...patch }));

  // Villages first: that is where teahouses are.
  const options = useMemo(() => {
    const rows = places.data?.items ?? [];
    return [...rows]
      .sort((a, b) =>
        a.category_code === b.category_code
          ? a.name_en.localeCompare(b.name_en)
          : a.category_code === 'village'
            ? -1
            : 1,
      )
      .map((p) => ({ value: p.id, label: `${p.name_en}${p.district ? ` (${p.district})` : ''}` }));
  }, [places.data]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: TeahouseIn = {
      ...form,
      name_en: form.name_en.trim(),
      name_ne: orNull(form.name_ne),
      phone: orNull(form.phone),
      price_note_en: orNull(form.price_note_en),
      price_note_ne: orNull(form.price_note_ne),
      source: form.source.trim(),
    };
    if (await withToast(save.mutateAsync({ id: house?.id, body }))) onClose();
  }

  async function onDelete() {
    if (!house || !window.confirm(t('common.confirmDelete', { name: house.name_en }))) return;
    const ok = await withToast(remove.mutateAsync(house.id), t('common.deleted'));
    if (ok !== undefined) onClose();
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <Select
          label={t('teahouses.place')}
          required
          searchable
          data={options}
          value={form.place_id || null}
          onChange={(v) => set({ place_id: v ?? '' })}
        />
        <Group grow>
          <TextInput
            label={t('teahouses.nameEn')}
            required
            value={form.name_en}
            onChange={(e) => set({ name_en: e.currentTarget.value })}
          />
          <TextInput
            label={t('teahouses.nameNe')}
            value={form.name_ne ?? ''}
            onChange={(e) => set({ name_ne: e.currentTarget.value })}
          />
        </Group>
        <TextInput
          label={t('teahouses.phone')}
          value={form.phone ?? ''}
          onChange={(e) => set({ phone: e.currentTarget.value })}
        />
        <Group grow>
          <TextInput
            label={t('teahouses.priceEn')}
            value={form.price_note_en ?? ''}
            onChange={(e) => set({ price_note_en: e.currentTarget.value })}
          />
          <TextInput
            label={t('teahouses.priceNe')}
            value={form.price_note_ne ?? ''}
            onChange={(e) => set({ price_note_ne: e.currentTarget.value })}
          />
        </Group>
        <Group grow>
          <YesNoUnknown
            label={t('teahouses.wifi')}
            value={form.has_wifi}
            onChange={(v) => set({ has_wifi: v })}
          />
          <YesNoUnknown
            label={t('teahouses.shower')}
            value={form.has_hot_shower}
            onChange={(v) => set({ has_hot_shower: v })}
          />
        </Group>
        <Textarea
          label={t('teahouses.source')}
          description={t('teahouses.sourceHint')}
          required
          minLength={3}
          autosize
          minRows={2}
          value={form.source}
          onChange={(e) => set({ source: e.currentTarget.value })}
        />
        <Group justify="space-between">
          {house ? (
            <Button color="red" variant="light" onClick={onDelete} loading={remove.isPending}>
              {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" loading={save.isPending} disabled={!form.place_id}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

const yesNo = (v: boolean | null, t: (k: string) => string) =>
  v == null ? (
    <Text c="dimmed">—</Text>
  ) : (
    <Badge variant="light" color={v ? 'green' : 'gray'}>
      {v ? t('common.yes') : t('common.no')}
    </Badge>
  );

export default function Teahouses() {
  const { t } = useTranslation();
  const teahouses = useTeahouses();
  const [editing, setEditing] = useState<Teahouse | null | undefined>(undefined);

  return (
    <>
      <PageHeader
        title={t('nav.teahouses')}
        right={<Button onClick={() => setEditing(null)}>{t('teahouses.new')}</Button>}
      />
      <QueryState query={teahouses}>
        {(items) =>
          items.length === 0 ? (
            <Text c="dimmed">{t('teahouses.empty')}</Text>
          ) : (
            <Table.ScrollContainer minWidth={820}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('teahouses.place')}</Table.Th>
                    <Table.Th>{t('teahouses.nameEn')}</Table.Th>
                    <Table.Th>{t('teahouses.phone')}</Table.Th>
                    <Table.Th>{t('teahouses.wifi')}</Table.Th>
                    <Table.Th>{t('teahouses.shower')}</Table.Th>
                    <Table.Th>{t('teahouses.source')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((h) => (
                    <Table.Tr
                      key={h.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setEditing(h)}
                    >
                      <Table.Td>{h.place_name}</Table.Td>
                      <Table.Td>{h.name_en}</Table.Td>
                      <Table.Td>{h.phone ?? '—'}</Table.Td>
                      <Table.Td>{yesNo(h.has_wifi, t)}</Table.Td>
                      <Table.Td>{yesNo(h.has_hot_shower, t)}</Table.Td>
                      <Table.Td maw={320}>
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {h.source}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )
        }
      </QueryState>
      <Modal
        size="lg"
        opened={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? editing.name_en : t('teahouses.new')}
      >
        {editing !== undefined && (
          <TeahouseModal
            key={editing?.id ?? 'new'}
            house={editing}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </>
  );
}
