import {
  ActionIcon,
  Badge,
  Button,
  Grid,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { PageHeader, QueryState } from '../components/ui';
import { numOrNull, orNull, withToast } from '../lib';
import { useAllPlaces, useDeleteTrek, usePermits, useSaveTrek, useTrek } from '../queries';
import { RISK_LEVELS, type RiskLevel, type Stage, type Trek, type TrekIn, type TrekText } from '../types';

/** A stage plus a local key so React keeps inputs in place while days are moved. */
type StageRow = Stage & { key: number };
type Form = Omit<TrekIn, 'stages'> & { stages: StageRow[] };

let nextKey = 1;
const withKey = (s: Stage): StageRow => ({ ...s, key: nextKey++ });

const blankStage = (from = ''): StageRow =>
  withKey({
    from_place_id: from,
    to_place_id: '',
    distance_km: 0,
    walk_hours: 0,
    highest_point_m: null,
    notes_en: '',
    notes_ne: '',
  });

const EMPTY: Form = {
  region: '',
  base_difficulty: 'moderate',
  is_published: true,
  en: { name: '', overview: '' },
  ne: { name: '', overview: '' },
  permit_codes: [],
  stages: [blankStage()],
};

function toForm(tr: Trek): Form {
  return {
    region: tr.region,
    base_difficulty: tr.base_difficulty,
    is_published: tr.is_published,
    en: { name: tr.en.name ?? '', overview: tr.en.overview ?? '' },
    ne: { name: tr.ne.name ?? '', overview: tr.ne.overview ?? '' },
    permit_codes: tr.permit_codes,
    stages: tr.stages.map(withKey),
  };
}

function toBody(f: Form): TrekIn {
  const text = (t: TrekText): TrekText => ({ name: orNull(t.name), overview: orNull(t.overview) });
  return {
    ...f,
    region: f.region.trim(),
    en: text(f.en),
    ne: text(f.ne),
    stages: f.stages.map(({ key: _key, ...s }) => ({
      ...s,
      notes_en: orNull(s.notes_en),
      notes_ne: orNull(s.notes_ne),
    })),
  };
}

function StageCard({
  stage,
  index,
  count,
  placeOptions,
  onChange,
  onMove,
  onRemove,
}: {
  stage: StageRow;
  index: number;
  count: number;
  placeOptions: { value: string; label: string }[];
  onChange: (patch: Partial<Stage>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isRest = !!stage.from_place_id && stage.from_place_id === stage.to_place_id;
  return (
    <Paper withBorder p="sm">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text fw={600}>{t('treks.day', { day: index + 1 })}</Text>
          {isRest && <Badge variant="light">{t('treks.restDay')}</Badge>}
        </Group>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            aria-label={t('treks.moveUp')}
            title={t('treks.moveUp')}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            aria-label={t('treks.moveDown')}
            title={t('treks.moveDown')}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={t('treks.removeDay')}
            title={t('treks.removeDay')}
            disabled={count === 1}
            onClick={onRemove}
          >
            ×
          </ActionIcon>
        </Group>
      </Group>
      <Grid gutter="xs">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label={t('treks.from')}
            required
            searchable
            data={placeOptions}
            value={stage.from_place_id || null}
            onChange={(v) => onChange({ from_place_id: v ?? '' })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label={t('treks.to')}
            required
            searchable
            data={placeOptions}
            value={stage.to_place_id || null}
            onChange={(v) => onChange({ to_place_id: v ?? '' })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 4 }}>
          <NumberInput
            label={t('treks.km')}
            min={0}
            max={60}
            decimalScale={1}
            value={stage.distance_km}
            onChange={(v) => onChange({ distance_km: Number(v) || 0 })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 4 }}>
          <NumberInput
            label={t('treks.hours')}
            min={0}
            max={14}
            decimalScale={1}
            value={stage.walk_hours}
            onChange={(v) => onChange({ walk_hours: Number(v) || 0 })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 4 }}>
          <NumberInput
            label={t('treks.highest')}
            min={0}
            max={8849}
            allowDecimal={false}
            value={stage.highest_point_m ?? ''}
            onChange={(v) => onChange({ highest_point_m: numOrNull(v) })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Textarea
            label={t('treks.notesEn')}
            autosize
            minRows={1}
            value={stage.notes_en ?? ''}
            onChange={(e) => onChange({ notes_en: e.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Textarea
            label={t('treks.notesNe')}
            autosize
            minRows={1}
            value={stage.notes_ne ?? ''}
            onChange={(e) => onChange({ notes_ne: e.currentTarget.value })}
          />
        </Grid.Col>
      </Grid>
    </Paper>
  );
}

function TrekEditor({ trek }: { trek?: Trek }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const places = useAllPlaces();
  const permits = usePermits();
  const saveTrek = useSaveTrek();
  const deleteTrek = useDeleteTrek();
  const [form, setForm] = useState<Form>(() => (trek ? toForm(trek) : EMPTY));
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const ne = i18n.language.startsWith('ne');

  const placeOptions = useMemo(
    () =>
      (places.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${(ne && p.name_ne) || p.name_en}${p.altitude_m != null ? ` (${p.altitude_m} m)` : ''}`,
      })),
    [places.data, ne],
  );

  const setStage = (i: number, patch: Partial<Stage>) =>
    setForm((f) => ({ ...f, stages: f.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const moveStage = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const stages = [...f.stages];
      [stages[i], stages[i + dir]] = [stages[i + dir], stages[i]];
      return { ...f, stages };
    });
  const removeStage = (i: number) =>
    setForm((f) => ({ ...f, stages: f.stages.filter((_, j) => j !== i) }));
  // A new day starts where the last one ended.
  const addStage = () =>
    setForm((f) => ({ ...f, stages: [...f.stages, blankStage(f.stages.at(-1)?.to_place_id)] }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const saved = await withToast(saveTrek.mutateAsync({ id: trek?.id, body: toBody(form) }));
    if (saved && !trek) navigate(`/treks/${saved.id}`, { replace: true });
  }

  async function onDelete() {
    if (!trek || !window.confirm(t('common.confirmDelete', { name: trek.en.name }))) return;
    const ok = await withToast(deleteTrek.mutateAsync(trek.id), t('common.deleted'));
    if (ok !== undefined) navigate('/treks');
  }

  const totalKm = form.stages.reduce((sum, s) => sum + (s.distance_km || 0), 0);

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={trek ? (trek.en.name ?? t('treks.edit')) : t('treks.new')}
        right={
          <Group>
            <Button variant="default" onClick={() => navigate('/treks')}>
              {t('common.back')}
            </Button>
            {trek && (
              <Button color="red" variant="light" onClick={onDelete} loading={deleteTrek.isPending}>
                {t('common.delete')}
              </Button>
            )}
            <Button type="submit" loading={saveTrek.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        }
      />
      <Grid>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <Paper withBorder p="md">
              <Tabs defaultValue="en">
                <Tabs.List>
                  <Tabs.Tab value="en">{t('common.english')}</Tabs.Tab>
                  <Tabs.Tab value="ne">{t('common.nepali')}</Tabs.Tab>
                </Tabs.List>
                {(['en', 'ne'] as const).map((lang) => (
                  <Tabs.Panel key={lang} value={lang}>
                    <Stack pt="sm">
                      {lang === 'ne' && (
                        <Text size="sm" c="dimmed">
                          {t('common.nepaliHint')}
                        </Text>
                      )}
                      <TextInput
                        label={t('treks.name')}
                        required={lang === 'en'}
                        maxLength={200}
                        value={form[lang].name ?? ''}
                        onChange={(e) =>
                          set({ [lang]: { ...form[lang], name: e.currentTarget.value } })
                        }
                      />
                      <Textarea
                        label={t('treks.overview')}
                        autosize
                        minRows={5}
                        value={form[lang].overview ?? ''}
                        onChange={(e) =>
                          set({ [lang]: { ...form[lang], overview: e.currentTarget.value } })
                        }
                      />
                    </Stack>
                  </Tabs.Panel>
                ))}
              </Tabs>
            </Paper>
            <Paper withBorder p="md">
              <Stack>
                <TextInput
                  label={t('treks.region')}
                  required
                  maxLength={80}
                  value={form.region}
                  onChange={(e) => set({ region: e.currentTarget.value })}
                />
                <Select
                  label={t('treks.difficulty')}
                  required
                  allowDeselect={false}
                  value={form.base_difficulty}
                  onChange={(v) => v && set({ base_difficulty: v as RiskLevel })}
                  data={RISK_LEVELS.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
                />
                <MultiSelect
                  label={t('treks.permits')}
                  searchable
                  value={form.permit_codes}
                  onChange={(permit_codes) => set({ permit_codes })}
                  data={(permits.data ?? []).map((p) => ({
                    value: p.code,
                    label: `${p.code} – ${(ne && p.name_ne) || p.name_en}`,
                  }))}
                />
                <Switch
                  label={t('common.published')}
                  checked={form.is_published}
                  onChange={(e) => set({ is_published: e.currentTarget.checked })}
                />
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            <Group justify="space-between">
              <Title order={4}>{t('treks.stages')}</Title>
              <Text size="sm" c="dimmed">
                {t('treks.days')}: {form.stages.length} · {Math.round(totalKm * 10) / 10}{' '}
                {t('treks.km')}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t('treks.stagesHint')}
            </Text>
            {form.stages.map((s, i) => (
              <StageCard
                key={s.key}
                stage={s}
                index={i}
                count={form.stages.length}
                placeOptions={placeOptions}
                onChange={(patch) => setStage(i, patch)}
                onMove={(dir) => moveStage(i, dir)}
                onRemove={() => removeStage(i)}
              />
            ))}
            <Button variant="light" onClick={addStage} disabled={form.stages.length >= 40}>
              {t('treks.addDay')}
            </Button>
          </Stack>
        </Grid.Col>
      </Grid>
    </form>
  );
}

export default function TrekForm() {
  const { id } = useParams();
  const trek = useTrek(id);
  if (!id) return <TrekEditor />;
  return <QueryState query={trek}>{(tr) => <TrekEditor key={tr.id} trek={tr} />}</QueryState>;
}
