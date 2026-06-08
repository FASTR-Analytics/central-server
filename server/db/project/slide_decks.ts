import type { Sql } from "postgres";
import { nanoid } from "nanoid";
import type {
  Slide,
  SlideDeckConfig,
  SlideDeckDetail,
  SlideDeckSummary,
  SlidePosition,
  SlideWithMeta,
} from "platform-lib";
import type { DBSlide, DBSlideDeck, DBSlideDeckFolder } from "./_project_database_types.ts";
import { tryCatchDatabaseAsync } from "../utils.ts";
import type { APIResponseWithData } from "../utils.ts";

function parseDeckConfig(deck: DBSlideDeck): SlideDeckConfig {
  if (deck.config) {
    try {
      return JSON.parse(deck.config) as SlideDeckConfig;
    } catch {
      // fall through to default
    }
  }
  return getStartingConfigForSlideDeck(deck.label);
}

export async function getAllSlideDecks(
  projectDb: Sql,
): Promise<APIResponseWithData<SlideDeckSummary[]>> {
  return await tryCatchDatabaseAsync(async () => {
    const decks = await projectDb<(DBSlideDeck & { first_slide_id: string | null })[]>`
      SELECT sd.*,
        (SELECT id FROM slides WHERE slide_deck_id = sd.id ORDER BY sort_order LIMIT 1) as first_slide_id
      FROM slide_decks sd ORDER BY sd.last_updated DESC
    `;

    return {
      success: true,
      data: decks.map((d) => ({
        id: d.id,
        label: d.label,
        folderId: d.folder_id,
        firstSlideId: d.first_slide_id,
        config: parseDeckConfig(d),
      })),
    };
  });
}

export async function getSlideDeckDetail(
  projectDb: Sql,
  deckId: string,
): Promise<APIResponseWithData<SlideDeckDetail>> {
  return await tryCatchDatabaseAsync(async () => {
    const deck = (
      await projectDb<DBSlideDeck[]>`
        SELECT * FROM slide_decks WHERE id = ${deckId}
      `
    ).at(0);

    if (!deck) {
      throw new Error("Slide deck not found");
    }

    const slideIds = (
      await projectDb<{ id: string }[]>`
        SELECT id FROM slides WHERE slide_deck_id = ${deckId} ORDER BY sort_order
      `
    ).map((row) => row.id);

    return {
      success: true,
      data: {
        id: deck.id,
        label: deck.label,
        plan: deck.plan ?? "",
        config: parseDeckConfig(deck),
        slideIds,
        lastUpdated: deck.last_updated,
      },
    };
  });
}

export async function createSlideDeck(
  projectDb: Sql,
  label: string,
  folderId?: string | null,
): Promise<APIResponseWithData<{ deckId: string; lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const deckId = nanoid();
    const lastUpdated = new Date().toISOString();
    const defaultConfig = getStartingConfigForSlideDeck(label);

    await projectDb`
      INSERT INTO slide_decks (id, label, plan, config, folder_id, last_updated)
      VALUES (${deckId}, ${label}, '', ${JSON.stringify(slideDeckConfigSchema.parse(defaultConfig))}, ${folderId ?? null}, ${lastUpdated})
    `;

    return { success: true, data: { deckId, lastUpdated } };
  });
}

export async function updateSlideDeckLabel(
  projectDb: Sql,
  deckId: string,
  label: string,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();
    await projectDb`
      UPDATE slide_decks SET label = ${label}, last_updated = ${lastUpdated} WHERE id = ${deckId}
    `;
    return { success: true, data: { lastUpdated } };
  });
}

export async function updateSlideDeckPlan(
  projectDb: Sql,
  deckId: string,
  plan: string,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();
    await projectDb`
      UPDATE slide_decks SET plan = ${plan}, last_updated = ${lastUpdated} WHERE id = ${deckId}
    `;
    return { success: true, data: { lastUpdated } };
  });
}

export async function updateSlideDeckConfig(
  projectDb: Sql,
  deckId: string,
  config: SlideDeckConfig,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();
    await projectDb`
      UPDATE slide_decks
      SET label = ${config.label}, config = ${JSON.stringify(slideDeckConfigSchema.parse(config))}, last_updated = ${lastUpdated}
      WHERE id = ${deckId}
    `;
    return { success: true, data: { lastUpdated } };
  });
}

export async function moveSlideDeckToFolder(
  projectDb: Sql,
  deckId: string,
  folderId: string | null,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();
    await projectDb`
      UPDATE slide_decks SET folder_id = ${folderId}, last_updated = ${lastUpdated} WHERE id = ${deckId}
    `;
    return { success: true, data: { lastUpdated } };
  });
}

export async function duplicateSlideDeck(
  projectDb: Sql,
  deckId: string,
  label: string,
  folderId?: string | null,
): Promise<APIResponseWithData<{ newDeckId: string; lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const deck = (
      await projectDb<DBSlideDeck[]>`SELECT * FROM slide_decks WHERE id = ${deckId}`
    ).at(0);
    if (!deck) throw new Error("Slide deck not found");

    const newDeckId = nanoid();
    const lastUpdated = new Date().toISOString();

    const config = parseDeckConfig(deck);
    config.label = label.trim();
    await projectDb`
      INSERT INTO slide_decks (id, label, plan, config, folder_id, last_updated)
      VALUES (${newDeckId}, ${label.trim()}, ${deck.plan ?? ""}, ${JSON.stringify(slideDeckConfigSchema.parse(config))}, ${folderId ?? null}, ${lastUpdated})
    `;

    const slides = await projectDb<{ config: string; sort_order: number }[]>`
      SELECT config, sort_order FROM slides WHERE slide_deck_id = ${deckId} ORDER BY sort_order
    `;

    for (const slide of slides) {
      const newSlideId = nanoid();
      await projectDb`
        INSERT INTO slides (id, slide_deck_id, sort_order, config, last_updated)
        VALUES (${newSlideId}, ${newDeckId}, ${slide.sort_order}, ${slide.config}, ${lastUpdated})
      `;
    }

    return { success: true, data: { newDeckId, lastUpdated } };
  });
}

export async function deleteSlideDeck(
  projectDb: Sql,
  deckId: string,
): Promise<APIResponseWithData<Record<never, never>>> {
  return await tryCatchDatabaseAsync(async () => {
    await projectDb`DELETE FROM slide_decks WHERE id = ${deckId}`;
    return { success: true, data: {} };
  });
}

// ─── Slides ──────────────────────────────────────────────────────────────────

export async function getSlides(
  projectDb: Sql,
  deckId: string,
): Promise<APIResponseWithData<SlideWithMeta[]>> {
  return await tryCatchDatabaseAsync(async () => {
    const rawSlides = await projectDb<DBSlide[]>`
      SELECT * FROM slides WHERE slide_deck_id = ${deckId} ORDER BY sort_order
    `;

    return {
      success: true,
      data: rawSlides.map((raw, index) => ({
        id: raw.id,
        deckId: raw.slide_deck_id,
        index,
        slide: JSON.parse(raw.config) as Slide,
        lastUpdated: raw.last_updated,
      })),
    };
  });
}

export async function getSlide(
  projectDb: Sql,
  slideId: string,
): Promise<APIResponseWithData<SlideWithMeta>> {
  return await tryCatchDatabaseAsync(async () => {
    const raw = (
      await projectDb<DBSlide[]>`SELECT * FROM slides WHERE id = ${slideId}`
    ).at(0);

    if (!raw) throw new Error("No slide with this id");

    const indexResult = (
      await projectDb<{ idx: string }[]>`
        SELECT COUNT(*) as idx FROM slides
        WHERE slide_deck_id = ${raw.slide_deck_id} AND sort_order < ${raw.sort_order}
      `
    ).at(0);

    return {
      success: true,
      data: {
        id: raw.id,
        deckId: raw.slide_deck_id,
        index: Number(indexResult?.idx ?? 0),
        slide: JSON.parse(raw.config) as Slide,
        lastUpdated: raw.last_updated,
      },
    };
  });
}

export async function createSlide(
  projectDb: Sql,
  deckId: string,
  position: SlidePosition,
  slide: Slide,
): Promise<APIResponseWithData<{ slideId: string; lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const slideId = nanoid();
    const lastUpdated = new Date().toISOString();

    let newSortOrder: number;

    if ("toEnd" in position) {
      const maxResult = (
        await projectDb<{ max_sort_order: number | null }[]>`
          SELECT max(sort_order) AS max_sort_order FROM slides WHERE slide_deck_id = ${deckId}
        `
      ).at(0);
      newSortOrder = (maxResult?.max_sort_order ?? 0) + 10;
    } else if ("toStart" in position) {
      const minResult = (
        await projectDb<{ min_sort_order: number | null }[]>`
          SELECT min(sort_order) AS min_sort_order FROM slides WHERE slide_deck_id = ${deckId}
        `
      ).at(0);
      newSortOrder = (minResult?.min_sort_order ?? 10) - 5;
    } else if ("after" in position) {
      const afterSlide = (
        await projectDb<{ sort_order: number }[]>`
          SELECT sort_order FROM slides WHERE id = ${position.after} AND slide_deck_id = ${deckId}
        `
      ).at(0);
      if (!afterSlide) throw new Error(`Target slide not found: ${position.after}`);
      newSortOrder = afterSlide.sort_order + 5;
    } else {
      const beforeSlide = (
        await projectDb<{ sort_order: number }[]>`
          SELECT sort_order FROM slides WHERE id = ${position.before} AND slide_deck_id = ${deckId}
        `
      ).at(0);
      if (!beforeSlide) throw new Error(`Target slide not found: ${position.before}`);
      newSortOrder = beforeSlide.sort_order - 5;
    }

    await projectDb.begin((sql) => [
      sql`
        INSERT INTO slides (id, slide_deck_id, sort_order, config, last_updated)
        VALUES (${slideId}, ${deckId}, ${newSortOrder}, ${JSON.stringify(slideConfigSchema.parse(slide))}, ${lastUpdated})
      `,
      sql`UPDATE slide_decks SET last_updated = ${lastUpdated} WHERE id = ${deckId}`,
      _reSequence(sql, deckId),
    ]);

    return { success: true, data: { slideId, lastUpdated } };
  });
}

export async function updateSlide(
  projectDb: Sql,
  slideId: string,
  slide: Slide,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const existing = (
      await projectDb<{ slide_deck_id: string }[]>`SELECT slide_deck_id FROM slides WHERE id = ${slideId}`
    ).at(0);

    if (!existing) throw new Error("Slide not found");

    const lastUpdated = new Date().toISOString();

    await projectDb.begin((sql) => [
      sql`
        UPDATE slides SET config = ${JSON.stringify(slideConfigSchema.parse(slide))}, last_updated = ${lastUpdated}
        WHERE id = ${slideId}
      `,
      sql`UPDATE slide_decks SET last_updated = ${lastUpdated} WHERE id = ${existing.slide_deck_id}`,
    ]);

    return { success: true, data: { lastUpdated } };
  });
}

export async function deleteSlides(
  projectDb: Sql,
  deckId: string,
  slideIds: string[],
): Promise<APIResponseWithData<{ deletedCount: number }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();

    await projectDb.begin((sql) => [
      sql`DELETE FROM slides WHERE slide_deck_id = ${deckId} AND id = ANY(${slideIds})`,
      sql`UPDATE slide_decks SET last_updated = ${lastUpdated} WHERE id = ${deckId}`,
      _reSequence(sql, deckId),
    ]);

    return { success: true, data: { deletedCount: slideIds.length } };
  });
}

export async function duplicateSlides(
  projectDb: Sql,
  deckId: string,
  slideIds: string[],
): Promise<APIResponseWithData<{ newSlideIds: string[]; lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();
    const newSlideIds: string[] = [];

    const originalSlides = await projectDb<{ id: string; config: string; sort_order: number }[]>`
      SELECT id, config, sort_order FROM slides
      WHERE slide_deck_id = ${deckId} AND id = ANY(${slideIds})
      ORDER BY sort_order
    `;

    const maxOriginalSortOrder = Math.max(...originalSlides.map((s) => s.sort_order));
    const numDuplicates = originalSlides.length;

    await projectDb`
      UPDATE slides SET sort_order = sort_order + ${numDuplicates * 10}
      WHERE slide_deck_id = ${deckId} AND sort_order > ${maxOriginalSortOrder}
    `;

    for (let i = 0; i < originalSlides.length; i++) {
      const original = originalSlides[i];
      const newSlideId = nanoid();
      const newSortOrder = maxOriginalSortOrder + 1 + i;

      await projectDb`
        INSERT INTO slides (id, slide_deck_id, sort_order, config, last_updated)
        VALUES (${newSlideId}, ${deckId}, ${newSortOrder}, ${original.config}, ${lastUpdated})
      `;
      newSlideIds.push(newSlideId);
    }

    await projectDb.begin((sql) => [
      sql`UPDATE slide_decks SET last_updated = ${lastUpdated} WHERE id = ${deckId}`,
      _reSequence(sql, deckId),
    ]);

    return { success: true, data: { newSlideIds, lastUpdated } };
  });
}

export async function moveSlides(
  projectDb: Sql,
  deckId: string,
  slideIds: string[],
  position: SlidePosition,
): Promise<APIResponseWithData<{ lastUpdated: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const lastUpdated = new Date().toISOString();

    const allSlidesRes = await getSlides(projectDb, deckId);
    if (!allSlidesRes.success) throw new Error("Failed to get slides");

    const allSlides = allSlidesRes.data;
    const idsSet = new Set(slideIds);

    const slidesToMove = slideIds.map((id) => allSlides.find((s) => s.id === id)!);
    const remaining = allSlides.filter((s) => !idsSet.has(s.id));

    let insertIndex: number;
    if ("toStart" in position) {
      insertIndex = 0;
    } else if ("toEnd" in position) {
      insertIndex = remaining.length;
    } else if ("after" in position) {
      const targetIndex = remaining.findIndex((s) => s.id === position.after);
      if (targetIndex === -1) throw new Error(`Target slide not found: ${position.after}`);
      insertIndex = targetIndex + 1;
    } else {
      const targetIndex = remaining.findIndex((s) => s.id === position.before);
      if (targetIndex === -1) throw new Error(`Target slide not found: ${position.before}`);
      insertIndex = targetIndex;
    }

    const reordered = [
      ...remaining.slice(0, insertIndex),
      ...slidesToMove,
      ...remaining.slice(insertIndex),
    ];

    await projectDb.begin(async (sql) => {
      for (let i = 0; i < reordered.length; i++) {
        await sql`
          UPDATE slides SET sort_order = ${(i + 1) * 10}
          WHERE id = ${reordered[i].id} AND slide_deck_id = ${deckId}
        `;
      }
      await sql`UPDATE slide_decks SET last_updated = ${lastUpdated} WHERE id = ${deckId}`;
    });

    return { success: true, data: { lastUpdated } };
  });
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export async function getAllSlideDeckFolders(
  projectDb: Sql,
): Promise<APIResponseWithData<{ id: string; label: string; color: string | null; sortOrder: number }[]>> {
  return await tryCatchDatabaseAsync(async () => {
    const rows = await projectDb<DBSlideDeckFolder[]>`
      SELECT * FROM slide_deck_folders ORDER BY sort_order
    `;
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        label: r.label,
        color: r.color,
        sortOrder: r.sort_order,
      })),
    };
  });
}

export async function createSlideDeckFolder(
  projectDb: Sql,
  label: string,
): Promise<APIResponseWithData<{ folderId: string }>> {
  return await tryCatchDatabaseAsync(async () => {
    const folderId = nanoid();
    const maxResult = (
      await projectDb<{ max_sort: number | null }[]>`SELECT max(sort_order) as max_sort FROM slide_deck_folders`
    ).at(0);
    const sortOrder = (maxResult?.max_sort ?? 0) + 10;

    await projectDb`
      INSERT INTO slide_deck_folders (id, label, sort_order) VALUES (${folderId}, ${label}, ${sortOrder})
    `;
    return { success: true, data: { folderId } };
  });
}

export async function updateSlideDeckFolder(
  projectDb: Sql,
  folderId: string,
  label: string,
): Promise<APIResponseWithData<Record<never, never>>> {
  return await tryCatchDatabaseAsync(async () => {
    await projectDb`UPDATE slide_deck_folders SET label = ${label} WHERE id = ${folderId}`;
    return { success: true, data: {} };
  });
}

export async function deleteSlideDeckFolder(
  projectDb: Sql,
  folderId: string,
): Promise<APIResponseWithData<Record<never, never>>> {
  return await tryCatchDatabaseAsync(async () => {
    await projectDb`DELETE FROM slide_deck_folders WHERE id = ${folderId}`;
    return { success: true, data: {} };
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function _reSequence(sql: Sql, deckId: string) {
  return sql`
    WITH tmp AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order) AS rn FROM slides WHERE slide_deck_id = ${deckId}
    )
    UPDATE slides SET sort_order = (SELECT (rn * 10) FROM tmp WHERE slides.id = tmp.id)
    WHERE slide_deck_id = ${deckId}
  `;
}
