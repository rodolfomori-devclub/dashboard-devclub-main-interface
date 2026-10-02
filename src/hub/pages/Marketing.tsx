import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Linkedin, Share2, Tag, Video, LayoutDashboard } from 'lucide-react';
import LinkedInAdsTab from '@/components/marketing/LinkedInAdsTab';
import ContentDistributionTab from '@/components/marketing/ContentDistributionTab';
import LowTicketDevClubTab from '@/components/marketing/LowTicketDevClubTab';
import WebinarGlobalTab from '@/components/marketing/WebinarGlobalTab';

import MonthlyBudgetCard from '@/components/marketing/MonthlyBudgetCard';

export default function Marketing() {
  const [tab, setTab] = useState('resumo');

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-sm text-muted-foreground">Módulo de marketing do Hub Comercial</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="resumo" className="gap-2">
            <LayoutDashboard className="h-4 w-4" /> Resumo Geral
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="gap-2">
            <Linkedin className="h-4 w-4" /> LinkedIn Ads
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2">
            <Share2 className="h-4 w-4" /> Distribuição de Conteúdo
          </TabsTrigger>
          <TabsTrigger value="lt-devclub" className="gap-2">
            <Tag className="h-4 w-4" /> Low Ticket DevClub
          </TabsTrigger>
          <TabsTrigger value="webinar-global" className="gap-2">
            <Video className="h-4 w-4" /> Webinar Global
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4 space-y-4">
          <MonthlyBudgetCard />
        </TabsContent>
        <TabsContent value="linkedin" className="mt-4">
          <LinkedInAdsTab />
        </TabsContent>
        <TabsContent value="content" className="mt-4">
          <ContentDistributionTab />
        </TabsContent>
        <TabsContent value="lt-devclub" className="mt-4">
          <LowTicketDevClubTab />
        </TabsContent>
        <TabsContent value="webinar-global" className="mt-4">
          <WebinarGlobalTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
