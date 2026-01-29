import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { LocalImageService } from './localImage.service'
import { LocalImage } from '@/types/local';
import { localDatabase } from './localDatabase.service';

vi.mock("./localDatabase.service", () => ({
    localDatabase: {
        insertImage: vi.fn(),
        insertImages:vi.fn(),
        upsertExifData: vi.fn(),
        markLocalStateModified: vi.fn()
    }
}))

vi.spyOn(console, 'log').mockImplementation(()=>{})

describe('LocalImageService', () => {

    let localImageService: LocalImageService;
    const image1: LocalImage = {
        id: 123,
        uuid: '123',
        filename: 'filename1',
        format: 'jpeg',
        width: 1920,
        height: 1080,
        hash: 'hash1',
        mimeType: 'img/jpeg',
        isCorrupted: false,
        createdAt: 'date1',
        updatedAt: 'date1',
        deletedAt: null,
        fileSize: 2048
    }

    const image2: LocalImage = {
        id: 234,
        uuid: '234',
        filename: 'filename2',
        format: 'png',
        width: 1920,
        height: 1080,
        hash: 'hash1',
        mimeType: 'img/jpeg',
        isCorrupted: false,
        createdAt: 'date2',
        updatedAt: 'date2',
        deletedAt: null,
        fileSize: 2048
    }

    beforeEach(() => {
        localImageService = new LocalImageService();
        vi.clearAllMocks()

    })

    it('should add sinlge image', async () => {
        (localDatabase.insertImage as Mock).mockResolvedValue(image1)
        const res = await localImageService.addImage(image1)
        expect(res).toEqual(image1)
        expect(localDatabase.markLocalStateModified).toHaveBeenCalledOnce()
    })

    it('should add multiple images', async () => {
        (localDatabase.insertImages as Mock)
            .mockResolvedValue([image1, image2])
           
        const res = await localImageService.addImages([image1, image2])
        expect(res).toEqual([image1, image2])
        expect(localDatabase.markLocalStateModified).toHaveBeenCalledOnce()

    })
})