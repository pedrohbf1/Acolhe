import Loading from "@/components/loading";
import { SWITCH_ORG_MUTATION_KEY } from "@/hooks/useSwitchOrganization";
import { useIsMutating } from "@tanstack/react-query";

/**
 * Overlay full-screen exibido enquanto a org ativa está sendo trocada. Sensação
 * de "carregando o novo sistema" — o app inteiro está reagregando suas queries
 * em torno da nova organização.
 */
export function OrgSwitchOverlay() {
  const switching =
    useIsMutating({ mutationKey: SWITCH_ORG_MUTATION_KEY }) > 0;

  return (
    <Loading
      show={switching}
      fullScreen
      description="Carregando organização…"
    />
  );
}
