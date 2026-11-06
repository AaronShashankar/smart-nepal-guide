import {
  ActionIcon,
  Button,
  FileButton,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { photoUrl } from '../api';
import { MapPicker } from '../components/MapPicker';
import { PageHeader, QueryState } from '../components/ui';
import { numOrNull, orNull, withToast } from '../lib';
import {
  useCategories,
  useDeletePhoto,
  useDeletePlace,
  usePlace,
  useSavePlace,
  useUploadPhoto,
} from '../queries';
import type { ClimateRow, Place, PlaceIn, PlaceText } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const emptyText = (): PlaceText => ({ name: '', description: '', how_to_reach: '' });

const EMPTY: PlaceIn = {
  category_code: '',
  latitude: 27.7172,
  longitude: 85.324,
  altitude_m: null,
  district: '',
  province: '',
  entry_fee_npr: null,
  is_published: true,
  en: emptyText(),
  ne: emptyText(),
  aliases: [],
  climate: [],
};

function toInput(p: Place): PlaceIn {
  const { id: _id, photos: _photos, updated_at: _u, ...rest } = p;
  return {
    ...rest,
    en: { ...emptyText(), ...p.en },
    ne: { ...emptyText(), ...p.ne },
  };
}

/** Trim strings and turn empty ones into null, as the API expects. */
function clean(f: PlaceIn): PlaceIn {
  const text = (t: PlaceText): PlaceText => ({
    name: orNull(t.name),
    description: orNull(t.description),
    how_to_reach: orNull(t.how_to_reach),
  });
  return {
    ...f,
    district: orNull(f.district),
    province: orNull(f.province),
    en: text(f.en),
    ne: text(f.ne),
    aliases: f.aliases.map((a) => a.trim()).filter(Boolean),
  };
}

function TextTab({
  value,
  onChange,
  required,
}: {
  value: PlaceText;
  onChange: (v: PlaceText) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Stack pt="sm">
      <TextInput
        label={t('places.name')}
        required={required}
        value={value.name ?? ''}
        onChange={(e) => onChange({ ...value, name: e.currentTarget.value })}
        maxLength={200}
      />
      <Textarea
        label={t('places.description')}
        autosize
        minRows={4}
        value={value.description ?? ''}
        onChange={(e) => onChange({ ...value, description: e.currentTarget.value })}
      />
      <Textarea
        label={t('places.howToReach')}
        autosize
        minRows={2}
        value={value.how_to_reach ?? ''}
        onChange={(e) => onChange({ ...value, how_to_reach: e.currentTarget.value })}
      />
    </Stack>
  );
}

function ClimateTable({
  rows,
  onChange,
}: {
  rows: ClimateRow[];
  onChange: (rows: ClimateRow[]) => void;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <Button
        variant="light"
        w="fit-content"
        onClick={() =>
          onChange(
            MONTHS.map((_, i) => ({
              month: i + 1,
              avg_temp_c: null,
              rainfall_mm: null,
              visibility_score: null,
            })),
          )
        }
      >
        {t('places.addClimate')}
      </Button>
    );
  }
  const set = (i: number, patch: Partial<ClimateRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Stack gap="xs">
      <Table.ScrollContainer minWidth={480}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('places.month')}</Table.Th>
              <Table.Th>{t('places.temp')}</Table.Th>
              <Table.Th>{t('places.rain')}</Table.Th>
              <Table.Th>{t('places.visibility')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r, i) => (
              <Table.Tr key={r.month}>
                <Table.Td>{MONTHS[r.month - 1]}</Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={-60}
                    max={50}
                    decimalScale={1}
                    value={r.avg_temp_c ?? ''}
                    onChange={(v) => set(i, { avg_temp_c: numOrNull(v) })}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    max={3000}
                    allowDecimal={false}
                    value={r.rainfall_mm ?? ''}
                    onChange={(v) => set(i, { rainfall_mm: numOrNull(v) })}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={1}
                    max={10}
                    allowDecimal={false}
                    value={r.visibility_score ?? ''}
                    onChange={(v) => set(i, { visibility_score: numOrNull(v) })}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Button variant="subtle" color="red" w="fit-content" onClick={() => onChange([])}>
        {t('places.removeClimate')}
      </Button>
    </Stack>
  );
}

function Photos({ place }: { place: Place }) {
  const { t } = useTranslation();
  const upload = useUploadPhoto();
  const remove = useDeletePhoto();
  return (
    <Stack>
      <Group gap="sm">
        {place.photos.map((ph) => (
          <div key={ph.id} className="photo-thumb">
            <img src={photoUrl(ph.url)} alt="" loading="lazy" />
            <ActionIcon
              color="red"
              variant="filled"
              size="sm"
              aria-label={t('common.delete')}
              loading={remove.isPending && remove.variables?.photoId === ph.id}
              onClick={() => {
                if (window.confirm(t('common.confirmDelete', { name: ph.url.split('/').pop() }))) {
                  withToast(
                    remove.mutateAsync({ placeId: place.id, photoId: ph.id }),
                    t('common.deleted'),
                  );
                }
              }}
            >
              ×
            </ActionIcon>
          </div>
        ))}
      </Group>
      <Group>
        <FileButton
          accept="image/jpeg,image/png,image/webp"
          onChange={(file) => {
            if (file) withToast(upload.mutateAsync({ placeId: place.id, file }));
          }}
        >
          {(props) => (
            <Button {...props} variant="light" loading={upload.isPending}>
              {t('places.upload')}
            </Button>
          )}
        </FileButton>
        <Text size="sm" c="dimmed">
          {t('places.uploadHint')}
        </Text>
      </Group>
    </Stack>
  );
}

function PlaceEditor({ place }: { place?: Place }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const categories = useCategories();
  const savePlace = useSavePlace();
  const deletePlace = useDeletePlace();
  const [form, setForm] = useState<PlaceIn>(() => (place ? toInput(place) : EMPTY));
  const set = (patch: Partial<PlaceIn>) => setForm((f) => ({ ...f, ...patch }));
  const ne = i18n.language.startsWith('ne');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const saved = await withToast(savePlace.mutateAsync({ id: place?.id, body: clean(form) }));
    if (saved && !place) navigate(`/places/${saved.id}`, { replace: true });
  }

  async function onDelete() {
    if (!place || !window.confirm(t('common.confirmDelete', { name: place.en.name }))) return;
    const ok = await withToast(deletePlace.mutateAsync(place.id), t('common.deleted'));
    if (ok !== undefined) navigate('/places');
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={place ? (place.en.name ?? t('places.edit')) : t('places.new')}
        right={
          <Group>
            <Button variant="default" onClick={() => navigate('/places')}>
              {t('common.back')}
            </Button>
            {place && (
              <Button color="red" variant="light" onClick={onDelete} loading={deletePlace.isPending}>
                {t('common.delete')}
              </Button>
            )}
            <Button type="submit" loading={savePlace.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        }
      />
      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            <Paper withBorder p="md">
              <Tabs defaultValue="en">
                <Tabs.List>
                  <Tabs.Tab value="en">{t('common.english')}</Tabs.Tab>
                  <Tabs.Tab value="ne">{t('common.nepali')}</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="en">
                  <TextTab value={form.en} onChange={(en) => set({ en })} required />
                </Tabs.Panel>
                <Tabs.Panel value="ne">
                  <Text size="sm" c="dimmed" pt="sm">
                    {t('common.nepaliHint')}
                  </Text>
                  <TextTab value={form.ne} onChange={(v) => set({ ne: v })} />
                </Tabs.Panel>
              </Tabs>
            </Paper>
            <Paper withBorder p="md">
              <TagsInput
                label={t('places.aliases')}
                description={t('places.aliasesHint')}
                value={form.aliases}
                onChange={(aliases) => set({ aliases })}
              />
            </Paper>
            <Paper withBorder p="md">
              <Title order={5}>{t('places.climate')}</Title>
              <Text size="sm" c="dimmed" mb="sm">
                {t('places.climateHint')}
              </Text>
              <ClimateTable rows={form.climate} onChange={(climate) => set({ climate })} />
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <Paper withBorder p="md">
              <Stack>
                <Select
                  label={t('places.category')}
                  required
                  searchable
                  value={form.category_code || null}
                  onChange={(v) => set({ category_code: v ?? '' })}
                  data={(categories.data ?? []).map((c) => ({
                    value: c.code,
                    label: (ne && c.name_ne) || c.name_en,
                  }))}
                />
                <Switch
                  label={t('common.published')}
                  checked={form.is_published}
                  onChange={(e) => set({ is_published: e.currentTarget.checked })}
                />
                <Group grow>
                  <TextInput
                    label={t('places.district')}
                    value={form.district ?? ''}
                    onChange={(e) => set({ district: e.currentTarget.value })}
                  />
                  <TextInput
                    label={t('places.province')}
                    value={form.province ?? ''}
                    onChange={(e) => set({ province: e.currentTarget.value })}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label={t('places.altitude')}
                    min={0}
                    max={8849}
                    allowDecimal={false}
                    value={form.altitude_m ?? ''}
                    onChange={(v) => set({ altitude_m: numOrNull(v) })}
                  />
                  <NumberInput
                    label={t('places.entryFee')}
                    min={0}
                    allowDecimal={false}
                    thousandSeparator=","
                    value={form.entry_fee_npr ?? ''}
                    onChange={(v) => set({ entry_fee_npr: numOrNull(v) })}
                  />
                </Group>
              </Stack>
            </Paper>
            <Paper withBorder p="md">
              <Stack gap="xs">
                <Group grow>
                  <NumberInput
                    label={t('places.latitude')}
                    required
                    min={26.3}
                    max={30.5}
                    decimalScale={6}
                    value={form.latitude}
                    onChange={(v) => set({ latitude: Number(v) })}
                  />
                  <NumberInput
                    label={t('places.longitude')}
                    required
                    min={80}
                    max={88.3}
                    decimalScale={6}
                    value={form.longitude}
                    onChange={(v) => set({ longitude: Number(v) })}
                  />
                </Group>
                <Text size="sm" c="dimmed">
                  {t('places.mapHint')}
                </Text>
                <MapPicker
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onChange={(latitude, longitude) => set({ latitude, longitude })}
                />
              </Stack>
            </Paper>
            <Paper withBorder p="md">
              <Title order={5} mb="sm">
                {t('places.photos')}
              </Title>
              {place ? <Photos place={place} /> : <Text c="dimmed">{t('places.saveFirst')}</Text>}
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </form>
  );
}

export default function PlaceForm() {
  const { id } = useParams();
  const place = usePlace(id);
  if (!id) return <PlaceEditor />;
  // key: a fresh form when moving between places
  return <QueryState query={place}>{(p) => <PlaceEditor key={p.id} place={p} />}</QueryState>;
}
