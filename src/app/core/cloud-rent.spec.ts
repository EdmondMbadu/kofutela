import { Cloud } from './cloud';

describe('Monthly rent synchronization', () => {
  it('continues through every page before the rent view is loaded', async () => {
    const cloud = new Cloud();
    const call = spyOn(cloud, 'call').and.returnValues(
      Promise.resolve({ created: 100, after: 'lease-100' }),
      Promise.resolve({ created: 6, after: null }),
    );
    await cloud.syncRent('portfolio', '2040-11');
    expect(call.calls.allArgs()).toEqual([
      ['syncRent', { orgId: 'portfolio', period: '2040-11' }],
      ['syncRent', { orgId: 'portfolio', period: '2040-11', after: 'lease-100' }],
    ]);
  });
  it('scopes tenant requests to the selected rental and surfaces failures', async () => {
    const cloud = new Cloud();
    const call = spyOn(cloud, 'call').and.resolveTo({ created: 1, after: null });
    await cloud.syncRent('portfolio', '2040-11', 'own-rental');
    expect(call).toHaveBeenCalledOnceWith('syncRent', {
      orgId: 'portfolio',
      period: '2040-11',
      leaseId: 'own-rental',
    });
    call.and.rejectWith(new Error('Connection interrupted'));
    await expectAsync(cloud.syncRent('portfolio', '2040-12')).toBeRejectedWithError(
      'Connection interrupted',
    );
  });
});
