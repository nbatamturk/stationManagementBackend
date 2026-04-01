import { withDatabase } from '@/database';
import type { StationPhotoAttachment } from '@/types';
import { getNowIso } from '@/utils/date';
import { createId } from '@/utils/id';

type AttachmentRow = {
  id: string;
  stationId: string;
  testHistoryId: string | null;
  issueId: string | null;
  localUri: string;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  syncStatus: StationPhotoAttachment['syncStatus'];
  createdAt: string;
};

const mapRow = (row: AttachmentRow): StationPhotoAttachment => ({
  id: row.id,
  stationId: row.stationId,
  testHistoryId: row.testHistoryId,
  issueId: row.issueId,
  localUri: row.localUri,
  mimeType: row.mimeType,
  fileName: row.fileName,
  fileSize: row.fileSize,
  syncStatus: row.syncStatus,
  createdAt: row.createdAt,
});

export const getStationPhotoAttachments = async (stationId: string): Promise<StationPhotoAttachment[]> => {
  return withDatabase(async (db) => {
    const rows = await db.getAllAsync<AttachmentRow>(
      `SELECT *
       FROM station_photo_attachments
       WHERE stationId = ?
       ORDER BY createdAt DESC;`,
      stationId,
    );

    return rows.map(mapRow);
  });
};

export const addStationPhotoAttachment = async (input: {
  stationId: string;
  localUri: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  testHistoryId?: string;
  issueId?: string;
}): Promise<string> => {
  const id = createId('photo');
  const now = getNowIso();

  await withDatabase(async (db) => {
    await db.runAsync(
      `INSERT INTO station_photo_attachments
        (id, stationId, testHistoryId, issueId, localUri, mimeType, fileName, fileSize, syncStatus, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      id,
      input.stationId,
      input.testHistoryId ?? null,
      input.issueId ?? null,
      input.localUri,
      input.mimeType ?? null,
      input.fileName ?? null,
      input.fileSize ?? null,
      'local',
      now,
    );
  });

  return id;
};
