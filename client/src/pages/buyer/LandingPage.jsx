import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { BuyerShell } from '@/features/buyer/components/BuyerShell';
import { ProjectCard, ProjectCardSkeleton } from '@/features/buyer/components/ProjectCard';
import { StartChatForm } from '@/features/buyer/components/StartChatForm';
import { useCatalog } from '@/features/buyer/hooks/useCatalog';
import { useLanguage } from '@/features/buyer/language';
import { useBuyerToken } from '@/features/buyer/session';

export function LandingPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const token = useBuyerToken();
  const catalog = useCatalog();
  const location = useLocation();
  const [projectCode, setProjectCode] = useState(null);
  const intentRef = useRef(location.state?.intent ?? null);
  const formRef = useRef(null);
  const nameRef = useRef(null);

  // "Talk to a person" from another page without a chat: bring the form into view.
  useEffect(() => {
    if (intentRef.current !== 'person') return;
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nameRef.current?.focus({ preventScroll: true });
  }, []);

  function openChat(intent, code) {
    navigate('/chat', { state: { intent, projectCode: code } });
  }

  /** Card buttons: straight into the chat if it exists, otherwise to the form with the project chosen. */
  function chooseProject(intent, code) {
    if (token) {
      openChat(intent, code);
      return;
    }
    intentRef.current = intent;
    setProjectCode(code);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nameRef.current?.focus({ preventScroll: true });
  }

  return (
    <BuyerShell onTalkToPerson={() => chooseProject('person', projectCode)}>
      <section className="mx-auto max-w-6xl px-5 pt-8 pb-12 sm:px-8 sm:pt-14 sm:pb-16">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {t.heroEyebrow}
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">
          {t.heroTitle}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t.heroBody}
        </p>
        <div className="mt-8 lg:hidden">
          {token ? (
            <Button asChild size="lg" className="h-11">
              <Link to="/chat">
                <MessageCircle /> {t.continueChat}
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="h-11" onClick={() => chooseProject(null, projectCode)}>
              <MessageCircle /> {t.startTitle}
            </Button>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_400px] lg:gap-12">
        <section aria-labelledby="projects-title" className="min-w-0 space-y-6">
          <h2 id="projects-title" className="text-2xl">
            {t.projectsTitle}
          </h2>
          {catalog.status === 'loading' && (
            <div className="space-y-6" aria-busy>
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
            </div>
          )}
          {catalog.status === 'error' && (
            <ErrorState
              title={t.loadProjectsFailed}
              message={catalog.error.message}
              onRetry={catalog.reload}
              retryLabel={t.retry}
            />
          )}
          {catalog.projects.map((project) => (
            <ProjectCard
              key={project.code}
              project={project}
              onAsk={(code) => chooseProject('ask', code)}
              onBook={(code) => chooseProject('book', code)}
            />
          ))}
        </section>

        <aside ref={formRef} id="start" className="min-w-0 scroll-mt-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8 lg:sticky lg:top-6">
            {token ? (
              <div className="space-y-4">
                <h2 className="text-2xl">{t.continueChat}</h2>
                <p className="text-sm text-muted-foreground">{t.continueBody}</p>
                <Button asChild size="lg" className="h-11 w-full">
                  <Link to="/chat">
                    {t.continueChat} <ArrowRight />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl">{t.startTitle}</h2>
                <p className="mt-1.5 mb-6 text-sm text-muted-foreground">{t.startBody}</p>
                <StartChatForm
                  projects={catalog.projects}
                  projectCode={projectCode}
                  onProjectChange={setProjectCode}
                  nameRef={nameRef}
                  onStarted={() => openChat(intentRef.current, projectCode)}
                />
              </>
            )}
          </div>
        </aside>
      </div>
    </BuyerShell>
  );
}
