import { CalendarCheck, MessageCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Estate Assist</p>
        <h1 className="text-4xl leading-tight sm:text-5xl">Find your home, book a visit.</h1>
        <p className="text-muted-foreground">
          Ask about our homes in English, Hindi or Gujarati and book a site visit in minutes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-serif text-xl">Project 1</CardTitle>
            <Badge variant="secondary">2 and 3 BHK</Badge>
          </div>
          <CardDescription>Site visits available this week.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="flex-1">
            <MessageCircle /> Ask a question
          </Button>
          <Button size="lg" variant="outline" className="flex-1">
            <CalendarCheck /> Book a visit
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
