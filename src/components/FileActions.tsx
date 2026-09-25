import { canShareFiles, saveFile, saveUsesShareSheet, shareFile } from '../lib/share';
import { AsyncButton, toast } from './ui';

/** dwa osobne przyciski dla gotowego pliku: udostępnij i zapisz na dysku */
export function FileActions(props: { file: File; small?: boolean }) {
  const cls = props.small ? ' small' : '';
  return (
    <>
      {canShareFiles() && (
        <AsyncButton className={`btn primary${cls}`} onClick={() => shareFile(props.file)}>
          📤 Udostępnij
        </AsyncButton>
      )}
      <AsyncButton
        className={`btn${canShareFiles() ? '' : ' primary'}${cls}`}
        onClick={async () => {
          if (saveUsesShareSheet()) toast('Wybierz „Zachowaj w Plikach”, aby zapisać plik na iPhonie', 'info', 6000);
          const r = await saveFile(props.file);
          if (r === 'saved') toast(`Zapisano: ${props.file.name}`);
          else if (r === 'downloaded') toast(`Pobrano do folderu Pobrane: ${props.file.name}`, 'ok', 5000);
        }}
      >
        💾 Zapisz
      </AsyncButton>
    </>
  );
}
