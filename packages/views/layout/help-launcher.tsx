"use client";

import { useRef } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  Download,
  History,
  Megaphone,
  MessageCircle,
} from "@multica/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import { useModalStore } from "@multica/core/modals";
import { useConfigStore } from "@multica/core/config";
import { useT } from "../i18n";
import { isDesktopShell } from "../platform/local-directory";
import { isTraditionalChinese } from "../common/docs-locale";
import {
  useWhatsNewMenuPanel,
  WhatsNewMenuPanel,
} from "../whats-new/whats-new-menu-panel";

const DOCS_URL = "https://cyberagent.ng/docs.html";
const CHANGELOG_URL = "https://cyberagent.ng";
const DOWNLOAD_URL = "https://multica.ai/download";

// cyberagent.ng ships one page per script variant: Traditional Chinese gets
// the "-Hant" suffix, every other language shares the English page.
const docsUrl = (language?: string) =>
  `${DOCS_URL}${isTraditionalChinese(language) ? "-Hant" : ""}`;

export function HelpLauncher() {
  const { t, i18n } = useT("layout");
  const serverVersion = useConfigStore((s) => s.serverVersion);
  // Web-only: offering "download the desktop app" inside the desktop app is
  // nonsense, and this sidebar is shared — apps/desktop renders the same
  // AppSidebar as the web dashboard, so the entry has to be gated here.
  const desktop = isDesktopShell();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const whatsNew = useWhatsNewMenuPanel();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          aria-label={t(($) => $.help.trigger)}
          title={t(($) => $.help.trigger)}
          className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground"
        >
          <CircleHelp className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={8}
          className="min-w-40 max-w-56"
        >
          {!desktop && (
            <>
              <DropdownMenuItem
                render={
                  <a
                    href={DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <Download className="h-3.5 w-3.5" />
                {t(($) => $.help.download_desktop)}
                <ArrowUpRight className="size-3 translate-y-px text-faint-foreground" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            render={
              <a
                href={docsUrl(i18n.language)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t(($) => $.help.docs)}
            <ArrowUpRight className="size-3 translate-y-px text-faint-foreground" />
          </DropdownMenuItem>
          {whatsNew.available && (
            <DropdownMenuItem onClick={whatsNew.show}>
              <Megaphone className="h-3.5 w-3.5" />
              {t(($) => $.whats_new.trigger)}
              {whatsNew.newestUnread && (
                <span
                  data-slot="whats-new-tag"
                  className="ml-auto text-caption font-medium text-brand tabular-nums"
                >
                  {`v${whatsNew.newestUnread}`}
                </span>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            render={
              <a
                href={CHANGELOG_URL}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <History className="h-3.5 w-3.5" />
            {t(($) => $.help.changelog)}
            <ArrowUpRight className="size-3 translate-y-px text-faint-foreground" />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => useModalStore.getState().open("feedback")}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t(($) => $.help.feedback)}
          </DropdownMenuItem>
          {serverVersion && (
            <>
              <DropdownMenuSeparator />
              {/* DropdownMenuLabel renders Base UI's Menu.GroupLabel, which reads
                a Menu.Group context and throws if it has no Group ancestor. It
                must always be wrapped in a DropdownMenuGroup — without it the
                Help menu crashes the whole app on open (no error boundary sits
                above the sidebar). */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal break-words">
                  {t(($) => $.help.server_version, { version: serverVersion })}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <WhatsNewMenuPanel panel={whatsNew} anchor={triggerRef} />
    </>
  );
}
