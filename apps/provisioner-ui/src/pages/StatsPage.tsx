import { PageLayout } from '../components/Layout/PageLayout'
import { StatsWidgets } from '../components/Stats'

function StatsPage() {
  return (
    <PageLayout
      headerProps={{
        title: 'vCenter Provisioner - Statistics'
      }}
    >
      <StatsWidgets />
    </PageLayout>
  )
}

export default StatsPage
