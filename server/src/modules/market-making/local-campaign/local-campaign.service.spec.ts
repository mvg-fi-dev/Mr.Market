import { LocalCampaignService } from './local-campaign.service';

describe('LocalCampaignService', () => {
  const createService = () => {
    const participationRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => ({ id: 'p-1', ...payload })),
    };

    const service = new LocalCampaignService(
      {} as any,
      participationRepository as any,
      {} as any,
    );

    return { service, participationRepository };
  };

  it('returns existing participation when already joined (idempotent)', async () => {
    const { service, participationRepository } = createService();

    participationRepository.findOne.mockResolvedValueOnce({
      id: 'existing',
      userId: 'u1',
      campaignId: 'c1',
      orderId: 'o1',
      status: 'joined',
    });

    const result = await service.joinCampaign('u1', 'c1', 'o1');

    expect(participationRepository.save).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'existing',
      }),
    );
  });

  it('dedupes on unique-violation by re-reading', async () => {
    const { service, participationRepository } = createService();

    participationRepository.findOne
      .mockResolvedValueOnce(null) // before save
      .mockResolvedValueOnce({
        id: 'after',
        userId: 'u1',
        campaignId: 'c1',
        orderId: 'o1',
        status: 'joined',
      }); // after unique error

    const err: any = new Error('duplicate');
    err.code = '23505';
    participationRepository.save.mockRejectedValueOnce(err);

    const result = await service.joinCampaign('u1', 'c1', 'o1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'after',
      }),
    );
  });
});
