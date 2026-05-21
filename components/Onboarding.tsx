/* eslint-disable max-lines */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  HardDrive,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Language, Theme } from '../types';
import { NOISE_BG_STYLE } from '../lib/noiseTexture';
import { useTransientState } from '../hooks/useTransientState';
import { NATIVE_LANG_NAMES, TRANSLATIONS } from '../constants';
import { AppStorageKeys } from '../services/appSettings';
import { setStoredString } from '../services/browserStorage';
import { downloadBlob, sanitizeDownloadFilename } from '../services/fileDownload';
import { SecurityService } from '../services/securityService';
import { CyberButton } from './CyberButton';

interface OnboardingProps {
  language: Language;
  onSetLanguage: (lang: Language) => void;
  theme?: Theme;
  onComplete: (password: string, directory: string[], selection: string[]) => void;
  onCancel?: () => void;
}

const AccessPassDetectorSeal: React.FC = () => (
  <div className="relative h-24 w-24 shrink-0">
    <div className="absolute inset-0 rounded-full border border-cyan-300/30 bg-cyan-300/5 shadow-[0_0_28px_rgba(0,200,232,0.18)]" />
    <div className="absolute inset-[9px] rounded-full border border-cyan-200/45" />
    <div className="absolute inset-[19px] rounded-full border border-dashed border-indigo-300/35" />
    <div className="absolute inset-[32px] rounded-full bg-[radial-gradient(circle,rgba(126,239,255,0.35)_0%,rgba(123,109,255,0.18)_48%,transparent_72%)]" />
    <div className="absolute left-1/2 top-1/2 h-px w-[46%] origin-left animate-[radar-spin_8s_linear_infinite] bg-gradient-to-r from-transparent via-cyan-100/80 to-cyan-300" />
    <div className="absolute inset-0 grid place-items-center">
      <ShieldCheck className="h-7 w-7 text-green-300 drop-shadow-[0_0_10px_rgba(134,239,172,0.45)]" />
    </div>
    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap border border-cyan-400/35 bg-black/50 px-2 py-1 text-[8px] uppercase tracking-[0.24em] text-cyan-200">
      Probe OK
    </div>
  </div>
);

export const Onboarding: React.FC<OnboardingProps> = ({
  language,
  onSetLanguage,
  theme = 'dark',
  onComplete,
  onCancel,
}) => {
  const isLight = theme === 'light';
  const t = TRANSLATIONS[language];
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const { value: error, setValue: setError } = useTransientState<string | null>(null);

  const [recoveryKey, setRecoveryKey] = useState('');
  const [isForgingCredential, setIsForgingCredential] = useState(false);
  const [credentialExportStatus, setCredentialExportStatus] = useState<
    'idle' | 'rendering' | 'success' | 'error'
  >('idle');
  const [issueFlash, setIssueFlash] = useState(false);
  const credentialCardRef = useRef<HTMLDivElement | null>(null);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 8) strength += 20;
    if (/[A-Z]/.test(pass)) strength += 20;
    if (/[a-z]/.test(pass)) strength += 20;
    if (/[0-9]/.test(pass)) strength += 20;
    if (/[^a-zA-Z0-9]/.test(pass)) strength += 20;
    return strength;
  };

  const validatePassword = (pass: string) => {
    return getPasswordStrength(pass) === 100;
  };

  const credentialParticles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        left: `${6 + ((index * 37) % 88)}%`,
        delay: `${((index * 17) % 35) / 10}s`,
        duration: `${2.5 + ((index * 11) % 18) / 10}s`,
        opacity: 0.25 + ((index * 13) % 55) / 100,
      })),
    [],
  );
  const hasIssuedAccessPass = Boolean(recoveryKey && credentialExportStatus === 'success');
  const isAccessPassReady = Boolean(recoveryKey && hasIssuedAccessPass);
  const isCredentialInputReady = validatePassword(password) && password === confirmPassword;
  const accessPassCopy = useMemo(() => {
    const copy = {
      zh: {
        title: 'VECTOR 离线凭证',
        detector: '恢复私钥',
        issued: '请保存这张离线凭证，用于忘记密令时恢复。',
        localTitle: '本地存储',
        localBody: '所有记录默认保存在你的设备中。',
        encryptionTitle: '加密保护',
        encryptionBody: '密令用于加密本地数据，系统不保存明文。',
        keyTitle: '用途',
        keyBody: '忘记密令时，用它验证身份并重设入口。',
        keyLabel: '恢复私钥',
        keyLevel: '级别：仅限离线',
        usageTitle: '使用方法：',
        usageBody:
          '当你忘记密码时，选择“忘记密码？使用恢复私钥”，输入这份恢复私钥完成验证。请离线保存，勿上传公开平台，勿发送给任何人。',
        ownerLabel: '归属',
        ownerValue: '只属于你',
        saveReminder: '保存后放在安全位置。VECTOR 不会替你找回。',
        exportSuccess: '离线凭证已保存。',
      },
      en: {
        title: 'VECTOR Space Access Pass',
        detector: 'Mindspace probe calibrated',
        issued: 'Access pass issued. Save the image and keep it offline.',
        localTitle: 'Local Storage',
        localBody: 'Records stay on your device by default.',
        encryptionTitle: 'Encryption',
        encryptionBody: 'Your password encrypts local data. Plaintext is not stored.',
        keyTitle: 'Private Key',
        keyBody: 'Use it to verify identity and reset access if the password is lost.',
        keyLabel: 'Encrypted Recovery Key',
        keyLevel: 'Level: Offline Only',
        usageTitle: 'Usage: ',
        usageBody:
          'If you forget your password or need to restore access, choose reset access and enter this key to verify ownership. Keep it offline. Do not upload it or send it to anyone.',
        ownerLabel: 'Ownership',
        ownerValue: 'Belongs to you',
        saveReminder: 'After saving PNG, keep it offline. VECTOR cannot recover this key.',
        exportSuccess: 'Access pass PNG saved.',
      },
      ja: {
        title: 'VECTOR 空間パス',
        detector: '意識空間プローブ校正済み',
        issued: '通行パスを発行しました。画像をオフラインで保管してください。',
        localTitle: 'ローカル保存',
        localBody: '記録は標準でこの端末に保存されます。',
        encryptionTitle: '暗号化保護',
        encryptionBody: 'パスワードでローカルデータを暗号化し、平文は保存しません。',
        keyTitle: '秘密鍵の用途',
        keyBody: 'パスワードを忘れた時、本人確認と入口の再設定に使います。',
        keyLabel: '暗号化復旧キー',
        keyLevel: 'レベル：オフライン限定',
        usageTitle: '使用方法：',
        usageBody:
          'アクセスを復旧する時にこのキーで所有者確認を行います。オフラインで保管し、公開クラウドや他者へ共有しないでください。',
        ownerLabel: '所有',
        ownerValue: 'あなたのもの',
        saveReminder:
          'PNG を保存し、オフラインで保管してください。VECTOR はこのキーを復元できません。',
        exportSuccess: '通行パス PNG を保存しました。',
      },
      ko: {
        title: 'VECTOR 공간 통행증',
        detector: '의식 공간 프로브 보정 완료',
        issued: '통행증이 발급되었습니다. 이미지를 오프라인에 보관하세요.',
        localTitle: '로컬 저장',
        localBody: '모든 기록은 기본적으로 이 기기에 저장됩니다.',
        encryptionTitle: '암호화 보호',
        encryptionBody: '비밀번호로 로컬 데이터를 암호화하며 원문은 저장하지 않습니다.',
        keyTitle: '개인키 용도',
        keyBody: '비밀번호를 잊었을 때 신원 확인과 입구 재설정에 사용합니다.',
        keyLabel: '암호화 복구 키',
        keyLevel: '등급: 오프라인 전용',
        usageTitle: '사용 방법: ',
        usageBody:
          '접근 복구가 필요할 때 이 키로 소유권을 확인합니다. 오프라인에 보관하고 공개 클라우드나 타인에게 공유하지 마세요.',
        ownerLabel: '소유',
        ownerValue: '당신에게 귀속',
        saveReminder: 'PNG를 저장한 뒤 오프라인에 보관하세요. VECTOR는 이 키를 복구할 수 없습니다.',
        exportSuccess: '통행증 PNG가 저장되었습니다.',
      },
      fr: {
        title: 'Pass VECTOR Space',
        detector: 'Centre de conscience calibré',
        issued: 'Pass émis. Enregistrez l’image et gardez-la hors ligne.',
        localTitle: 'Stockage local',
        localBody: 'Tous les enregistrements restent par défaut sur votre appareil.',
        encryptionTitle: 'Protection chiffrée',
        encryptionBody: 'Le mot de passe chiffre les données locales. Le texte clair est absent.',
        keyTitle: 'Usage de la clé',
        keyBody: 'Elle vérifie votre identité et réinitialise l’accès en cas d’oubli.',
        keyLabel: 'Clé de récupération chiffrée',
        keyLevel: 'Niveau : hors ligne uniquement',
        usageTitle: 'Utilisation : ',
        usageBody:
          'Si vous oubliez le mot de passe, choisissez la réinitialisation et saisissez cette clé. Conservez-la hors ligne, sans l’envoyer ni l’importer sur une plateforme publique.',
        ownerLabel: 'Appartenance',
        ownerValue: 'À vous seul',
        saveReminder:
          'Après le PNG, gardez-le hors ligne. VECTOR ne pourra pas retrouver cette clé.',
        exportSuccess: 'Pass PNG enregistré.',
      },
      es: {
        title: 'Pase VECTOR Space',
        detector: 'Centro de conciencia calibrado',
        issued: 'Pase emitido. Guarda la imagen en un lugar sin conexión.',
        localTitle: 'Almacenamiento local',
        localBody: 'Todos los registros se guardan por defecto en tu dispositivo.',
        encryptionTitle: 'Protección cifrada',
        encryptionBody: 'La contraseña cifra los datos locales. El texto claro no se guarda.',
        keyTitle: 'Uso de la clave',
        keyBody: 'Sirve para verificar tu identidad y restablecer el acceso.',
        keyLabel: 'Clave de recuperación cifrada',
        keyLevel: 'Nivel: solo sin conexión',
        usageTitle: 'Uso: ',
        usageBody:
          'Si olvidas la contraseña, elige restablecer acceso e introduce esta clave. Guárdala sin conexión. No la subas a plataformas públicas ni la envíes a nadie.',
        ownerLabel: 'Propiedad',
        ownerValue: 'Solo tuyo',
        saveReminder:
          'Después de guardar el PNG, mantenlo sin conexión. VECTOR no puede recuperar esta clave.',
        exportSuccess: 'Pase PNG guardado.',
      },
      de: {
        title: 'VECTOR Space Pass',
        detector: 'Bewusstseinszentrum kalibriert',
        issued: 'Pass ausgestellt. Speichere das Bild offline.',
        localTitle: 'Lokale Speicherung',
        localBody: 'Alle Aufzeichnungen bleiben standardmäßig auf deinem Gerät.',
        encryptionTitle: 'Verschlüsselung',
        encryptionBody: 'Das Passwort verschlüsselt lokale Daten. Klartext wird nicht gespeichert.',
        keyTitle: 'Schlüsselzweck',
        keyBody: 'Er bestätigt deine Identität und setzt den Zugang zurück.',
        keyLabel: 'Verschlüsselter Wiederherstellungsschlüssel',
        keyLevel: 'Stufe: nur offline',
        usageTitle: 'Verwendung: ',
        usageBody:
          'Wenn du das Passwort vergisst, wähle Zugang zurücksetzen und gib diesen Schlüssel ein. Offline aufbewahren, nicht öffentlich hochladen und niemandem senden.',
        ownerLabel: 'Eigentum',
        ownerValue: 'Gehört dir',
        saveReminder:
          'Nach dem PNG-Export offline aufbewahren. VECTOR kann diesen Schlüssel nicht wiederherstellen.',
        exportSuccess: 'Pass-PNG gespeichert.',
      },
    };

    return copy[language];
  }, [language]);

  const onboardingCopy = useMemo(() => {
    const copy: Record<
      Language,
      {
        title: string;
        subtitle: string;
        calibrated: string;
        calibrating: string;
        passwordConfirmed: string;
        accessLocked: string;
        keyIssued: string;
        plaintextNotStored: string;
        ownership: string;
        belongsToVessel: string;
        reissue: string;
        passwordLabel: string;
        confirmLabel: string;
        requirementLength: string;
        requirementUpper: string;
        requirementLower: string;
        requirementNumber: string;
        requirementSpecial: string;
        requirementMatch: string;
        forging: string;
        regenerate: string;
        startCalibrate: string;
        waitingCalibration: string;
        savedTitle: string;
        generatedTitle: string;
        savedBody: string;
        generatedBody: string;
        savingPng: string;
        savePng: string;
        savedReady: string;
        pngError: string;
        savePngFirst: string;
        readyStatus: string;
        confirmBackupStatus: string;
        savePngStatus: string;
        issueFirstStatus: string;
        enter: string;
        locked: string;
        copyKey: string;
        hidePassword: string;
        showPassword: string;
        selectLanguage: string;
      }
    > = {
      zh: {
        title: '接入 VECTOR 意识中心',
        subtitle: '设置密令，领取专属私钥。',
        calibrated: '初步校准完成',
        calibrating: '初步校准',
        passwordConfirmed: '密令已确认',
        accessLocked: '接入密令已锁定',
        keyIssued: '恢复私钥',
        plaintextNotStored: '明文不会被系统保存',
        ownership: '归属',
        belongsToVessel: '只属于这艘意识小船',
        reissue: '重新生成',
        passwordLabel: '设置接入密令',
        confirmLabel: '再次确认密令',
        requirementLength: '密令长度',
        requirementUpper: '大写信号',
        requirementLower: '小写信号',
        requirementNumber: '数字锚点',
        requirementSpecial: '符号校验',
        requirementMatch: '一致校准',
        forging: '正在生成',
        regenerate: '重新生成',
        startCalibrate: '完成校准，签发恢复私钥',
        waitingCalibration: '确认密令，签发私钥',
        savedTitle: '离线凭证已保存',
        generatedTitle: '恢复私钥已签发',
        savedBody: '请妥善保管，忘记密令时会用到。',
        generatedBody: '请保存离线副本，用于找回入口。',
        savingPng: '正在保存 PNG',
        savePng: '保存离线凭证',
        savedReady: '已保存，可进入',
        pngError: 'PNG 生成失败，请重试。',
        savePngFirst: '请先保存离线凭证',
        readyStatus: '可以进入',
        confirmBackupStatus: '离线凭证已保存',
        savePngStatus: '保存离线凭证后可进入',
        issueFirstStatus: '先生成恢复私钥',
        enter: '进入 VECTOR 意识中心',
        locked: '暂不可进入',
        copyKey: '复制恢复私钥',
        hidePassword: '隐藏密码',
        showPassword: '显示密码',
        selectLanguage: '选择语言',
      },
      en: {
        title: 'Connect to VECTOR Mindspace',
        subtitle:
          'Connected to VECTOR Space. VECTOR will begin initial calibration and issue an offline private key that belongs only to you.',
        calibrated: 'Access Calibrated',
        calibrating: 'Access Calibration',
        passwordConfirmed: 'Password Confirmed',
        accessLocked: 'Access permit locked',
        keyIssued: 'Key Issued',
        plaintextNotStored: 'Plaintext is not stored',
        ownership: 'Ownership',
        belongsToVessel: 'Belongs to this mind vessel',
        reissue: 'Re-Issue',
        passwordLabel: 'Set access code',
        confirmLabel: 'Confirm access code',
        requirementLength: '8+ characters',
        requirementUpper: 'Uppercase detected',
        requirementLower: 'Lowercase detected',
        requirementNumber: 'Number anchor',
        requirementSpecial: 'Symbol passed',
        requirementMatch: 'Consistency calibration',
        forging: 'Calibrating, forging key',
        regenerate: 'Recalibrate key',
        startCalibrate: 'Start calibration · Issue',
        waitingCalibration: 'Awaiting code calibration',
        savedTitle: 'Pass archived offline',
        generatedTitle: 'Offline key issued',
        savedBody: 'Ownership confirmed. No plaintext enters VECTOR.',
        generatedBody: 'Your only recovery key. Save it to enter.',
        savingPng: 'Saving PNG',
        savePng: 'Save offline pass',
        savedReady: 'Archived. Ready to enter',
        pngError: 'PNG export failed. Please try again.',
        savePngFirst: 'Please save the offline pass first',
        readyStatus: 'Calibration complete',
        confirmBackupStatus: 'Confirm offline pass',
        savePngStatus: 'Save offline pass',
        issueFirstStatus: 'Complete initial calibration first',
        enter: 'Enter VECTOR Mindspace',
        locked: 'Waiting for recovery key',
        copyKey: 'Copy private key',
        hidePassword: 'Hide password',
        showPassword: 'Show password',
        selectLanguage: 'Select language',
      },
      ja: {
        title: 'VECTOR 意識センターへ接続',
        subtitle:
          'VECTOR 空間への接続に成功しました。VECTOR は初期校正を開始し、あなただけのオフライン秘密鍵を発行します。',
        calibrated: '初期校正完了',
        calibrating: '初期校正',
        passwordConfirmed: 'パスワード確認済み',
        accessLocked: 'アクセスコードをロック',
        keyIssued: '秘密鍵を発行済み',
        plaintextNotStored: '平文は保存されません',
        ownership: '証明書の所有',
        belongsToVessel: 'この意識船だけに属します',
        reissue: '再発行',
        passwordLabel: 'アクセスコードを設定',
        confirmLabel: 'アクセスコードを再確認',
        requirementLength: '8文字以上',
        requirementUpper: '大文字検出',
        requirementLower: '小文字検出',
        requirementNumber: '数字アンカー',
        requirementSpecial: '記号通過',
        requirementMatch: '整合性校正',
        forging: '校正中、秘密鍵を生成中',
        regenerate: '秘密鍵を再校正',
        startCalibrate: '校正開始 · パス発行',
        waitingCalibration: 'コード校正待ち',
        savedTitle: '通行パスを保存済み',
        generatedTitle: 'オフライン秘密鍵を発行',
        savedBody: '所有を確認。平文は保存されません。',
        generatedBody: '唯一の復旧証明書です。保存後に入れます。',
        savingPng: 'PNG を保存中',
        savePng: 'オフラインパスを保存',
        savedReady: '保存済み。入れます',
        pngError: 'PNG 生成に失敗しました。もう一度お試しください。',
        savePngFirst: '先に通行パス PNG を保存してください',
        readyStatus: '校正完了、入場可能',
        confirmBackupStatus: 'オフライン保存を確認',
        savePngStatus: '通行パス PNG を保存',
        issueFirstStatus: '先に初期校正を完了',
        enter: 'VECTOR 意識センターへ入る',
        locked: '証明書待ち',
        copyKey: '秘密鍵をコピー',
        hidePassword: 'パスワードを隠す',
        showPassword: 'パスワードを表示',
        selectLanguage: '言語を選択',
      },
      ko: {
        title: 'VECTOR 의식 센터 접속',
        subtitle:
          '벡터 공간에 성공적으로 접속했습니다. VECTOR가 초기 보정을 시작하고 당신만의 오프라인 개인키를 발급합니다.',
        calibrated: '초기 보정 완료',
        calibrating: '초기 보정',
        passwordConfirmed: '비밀번호 확인됨',
        accessLocked: '접속 암호 잠김',
        keyIssued: '개인키 발급됨',
        plaintextNotStored: '원문은 시스템에 저장되지 않음',
        ownership: '증명서 소유',
        belongsToVessel: '이 의식선에만 귀속',
        reissue: '재발급',
        passwordLabel: '접속 암호 설정',
        confirmLabel: '접속 암호 재확인',
        requirementLength: '8자 이상',
        requirementUpper: '대문자 인식',
        requirementLower: '소문자 인식',
        requirementNumber: '숫자 앵커',
        requirementSpecial: '기호 통과',
        requirementMatch: '일관성 보정',
        forging: '보정 중, 개인키 생성 중',
        regenerate: '개인키 재보정',
        startCalibrate: '보정 시작 · 통행증 발급',
        waitingCalibration: '암호 보정 대기',
        savedTitle: '통행증 오프라인 보관됨',
        generatedTitle: '오프라인 개인키 발급됨',
        savedBody: '소유 확인. 원문은 시스템에 저장되지 않습니다.',
        generatedBody: '유일한 복구 증명서입니다. 저장 후 들어갈 수 있습니다.',
        savingPng: 'PNG 저장 중',
        savePng: '오프라인 통행증 저장',
        savedReady: '보관 완료. 입장 가능',
        pngError: 'PNG 생성 실패. 다시 시도하세요.',
        savePngFirst: '먼저 통행증 PNG를 저장하세요',
        readyStatus: '보정 완료, 진입 가능',
        confirmBackupStatus: '오프라인 저장 확인',
        savePngStatus: '통행증 PNG 저장',
        issueFirstStatus: '먼저 초기 보정 완료',
        enter: 'VECTOR 의식 센터로 진입',
        locked: '증명서 대기',
        copyKey: '개인키 복사',
        hidePassword: '비밀번호 숨기기',
        showPassword: '비밀번호 표시',
        selectLanguage: '언어 선택',
      },
      fr: {
        title: 'Connexion au centre de conscience VECTOR',
        subtitle:
          'Connexion réussie à l’espace VECTOR. VECTOR lancera la calibration initiale et émettra votre clé privée hors ligne.',
        calibrated: 'Calibration initiale terminée',
        calibrating: 'Calibration initiale',
        passwordConfirmed: 'Mot de passe confirmé',
        accessLocked: 'Code d’accès verrouillé',
        keyIssued: 'Clé privée émise',
        plaintextNotStored: 'Le clair n’est pas stocké',
        ownership: 'Appartenance',
        belongsToVessel: 'Lié à ce vaisseau de conscience',
        reissue: 'Réémettre',
        passwordLabel: 'Définir le code d’accès',
        confirmLabel: 'Confirmer le code',
        requirementLength: '8 caractères min.',
        requirementUpper: 'Majuscule détectée',
        requirementLower: 'Minuscule détectée',
        requirementNumber: 'Ancre numérique',
        requirementSpecial: 'Symbole validé',
        requirementMatch: 'Calibration cohérence',
        forging: 'Calibration, génération de clé',
        regenerate: 'Recalibrer la clé',
        startCalibrate: 'Calibrer · Émettre le pass',
        waitingCalibration: 'En attente du code',
        savedTitle: 'Pass archivé hors ligne',
        generatedTitle: 'Clé hors ligne émise',
        savedBody: 'Appartenance confirmée. Aucun clair dans VECTOR.',
        generatedBody: 'Votre seul justificatif de récupération. Enregistrez-le pour entrer.',
        savingPng: 'Enregistrement du PNG',
        savePng: 'Enregistrer le pass hors ligne',
        savedReady: 'Archivé. Prêt à entrer',
        pngError: 'Échec de génération PNG. Réessayez.',
        savePngFirst: 'Veuillez d’abord enregistrer le pass PNG',
        readyStatus: 'Calibration terminée',
        confirmBackupStatus: 'Confirmer la sauvegarde hors ligne',
        savePngStatus: 'Enregistrer le pass PNG',
        issueFirstStatus: 'Terminer la calibration initiale',
        enter: 'Entrer dans le centre VECTOR',
        locked: 'En attente du justificatif',
        copyKey: 'Copier la clé privée',
        hidePassword: 'Masquer le mot de passe',
        showPassword: 'Afficher le mot de passe',
        selectLanguage: 'Choisir la langue',
      },
      es: {
        title: 'Conectar al centro de conciencia VECTOR',
        subtitle:
          'Conexión exitosa al espacio vectorial. VECTOR iniciará la calibración inicial y emitirá tu clave privada sin conexión.',
        calibrated: 'Calibración inicial completa',
        calibrating: 'Calibración inicial',
        passwordConfirmed: 'Contraseña confirmada',
        accessLocked: 'Código de acceso bloqueado',
        keyIssued: 'Clave privada emitida',
        plaintextNotStored: 'El texto claro no se guarda',
        ownership: 'Propiedad',
        belongsToVessel: 'Pertenece a esta nave de conciencia',
        reissue: 'Reemitir',
        passwordLabel: 'Definir código de acceso',
        confirmLabel: 'Confirmar código de acceso',
        requirementLength: '8 caracteres mín.',
        requirementUpper: 'Mayúscula detectada',
        requirementLower: 'Minúscula detectada',
        requirementNumber: 'Ancla numérica',
        requirementSpecial: 'Símbolo validado',
        requirementMatch: 'Calibración coherente',
        forging: 'Calibrando, generando clave',
        regenerate: 'Recalibrar clave',
        startCalibrate: 'Calibrar · Emitir pase',
        waitingCalibration: 'Esperando calibración',
        savedTitle: 'Pase archivado sin conexión',
        generatedTitle: 'Clave sin conexión emitida',
        savedBody: 'Propiedad confirmada. VECTOR no guarda texto claro.',
        generatedBody: 'Tu única credencial de recuperación. Guárdala para entrar.',
        savingPng: 'Guardando PNG',
        savePng: 'Guardar pase sin conexión',
        savedReady: 'Archivado. Listo para entrar',
        pngError: 'No se pudo generar el PNG. Inténtalo de nuevo.',
        savePngFirst: 'Primero guarda el pase PNG',
        readyStatus: 'Calibración completa',
        confirmBackupStatus: 'Confirmar guardado sin conexión',
        savePngStatus: 'Guardar pase PNG',
        issueFirstStatus: 'Completa primero la calibración',
        enter: 'Entrar al centro VECTOR',
        locked: 'Esperando credencial',
        copyKey: 'Copiar clave privada',
        hidePassword: 'Ocultar contraseña',
        showPassword: 'Mostrar contraseña',
        selectLanguage: 'Seleccionar idioma',
      },
      de: {
        title: 'Mit dem VECTOR-Bewusstseinszentrum verbinden',
        subtitle:
          'Verbindung zum Vektorraum erfolgreich. VECTOR startet die Erstkalibrierung und stellt deinen Offline-Privatschlüssel aus.',
        calibrated: 'Erstkalibrierung abgeschlossen',
        calibrating: 'Erstkalibrierung',
        passwordConfirmed: 'Passwort bestätigt',
        accessLocked: 'Zugangscode gesperrt',
        keyIssued: 'Privatschlüssel ausgestellt',
        plaintextNotStored: 'Klartext wird nicht gespeichert',
        ownership: 'Eigentum',
        belongsToVessel: 'Gehört zu diesem Bewusstseinsschiff',
        reissue: 'Neu ausstellen',
        passwordLabel: 'Zugangscode festlegen',
        confirmLabel: 'Zugangscode bestätigen',
        requirementLength: 'Mind. 8 Zeichen',
        requirementUpper: 'Großbuchstabe erkannt',
        requirementLower: 'Kleinbuchstabe erkannt',
        requirementNumber: 'Zahlenanker',
        requirementSpecial: 'Symbol bestätigt',
        requirementMatch: 'Konsistenzkalibrierung',
        forging: 'Kalibrierung, Schlüssel wird erzeugt',
        regenerate: 'Schlüssel neu kalibrieren',
        startCalibrate: 'Kalibrieren · Pass ausstellen',
        waitingCalibration: 'Warte auf Codekalibrierung',
        savedTitle: 'Pass offline gesichert',
        generatedTitle: 'Offline-Schlüssel ausgestellt',
        savedBody: 'Eigentum bestätigt. Kein Klartext in VECTOR.',
        generatedBody: 'Dein einziger Wiederherstellungsnachweis. Speichern, dann eintreten.',
        savingPng: 'PNG wird gespeichert',
        savePng: 'Offline-Pass speichern',
        savedReady: 'Gesichert. Bereit',
        pngError: 'PNG-Erzeugung fehlgeschlagen. Bitte erneut versuchen.',
        savePngFirst: 'Bitte zuerst das Pass-PNG speichern',
        readyStatus: 'Kalibrierung abgeschlossen',
        confirmBackupStatus: 'Offline-Sicherung bestätigen',
        savePngStatus: 'Pass-PNG speichern',
        issueFirstStatus: 'Erstkalibrierung zuerst abschließen',
        enter: 'VECTOR-Zentrum betreten',
        locked: 'Warte auf Nachweis',
        copyKey: 'Privatschlüssel kopieren',
        hidePassword: 'Passwort verbergen',
        showPassword: 'Passwort anzeigen',
        selectLanguage: 'Sprache wählen',
      },
    };

    return copy[language];
  }, [language]);
  const calibrationRequirements = [
    {
      label: onboardingCopy.requirementLength,
      met: password.length >= 8,
    },
    {
      label: onboardingCopy.requirementUpper,
      met: /[A-Z]/.test(password),
    },
    {
      label: onboardingCopy.requirementLower,
      met: /[a-z]/.test(password),
    },
    {
      label: onboardingCopy.requirementNumber,
      met: /[0-9]/.test(password),
    },
    {
      label: onboardingCopy.requirementSpecial,
      met: /[^a-zA-Z0-9]/.test(password),
    },
    {
      label: onboardingCopy.requirementMatch,
      met: Boolean(password && confirmPassword && password === confirmPassword),
    },
  ];
  const calibrationProgress = getPasswordStrength(password);
  const fulfilledCalibrationCount = calibrationRequirements.filter((req) => req.met).length;
  const currentCalibrationIndex = calibrationRequirements.findIndex((req) => !req.met);
  const currentCalibrationRequirement =
    currentCalibrationIndex >= 0 ? calibrationRequirements[currentCalibrationIndex] : null;
  const calibrationCtaLabel = (() => {
    if (isForgingCredential) return onboardingCopy.forging;
    if (recoveryKey) return onboardingCopy.regenerate;
    if (isCredentialInputReady) return onboardingCopy.startCalibrate;
    if (currentCalibrationRequirement?.label === onboardingCopy.requirementMatch) {
      return language === 'zh' ? '等待密令一致' : 'Waiting for matching code';
    }
    if (currentCalibrationRequirement) {
      return language === 'zh' ? '等待密令完整' : 'Waiting for complete code';
    }
    return onboardingCopy.waitingCalibration;
  })();
  const [calibrationSyncPulse, setCalibrationSyncPulse] = useState(false);
  const previousCredentialReadyRef = useRef(false);

  useEffect(() => {
    setRecoveryKey('');
    setIsForgingCredential(false);
    setCredentialExportStatus('idle');
    setIssueFlash(false);
  }, [password, confirmPassword]);

  useEffect(() => {
    if (isCredentialInputReady && !previousCredentialReadyRef.current) {
      setCalibrationSyncPulse(true);
      const timer = window.setTimeout(() => setCalibrationSyncPulse(false), 900);
      previousCredentialReadyRef.current = true;
      return () => window.clearTimeout(timer);
    }
    if (!isCredentialInputReady) {
      previousCredentialReadyRef.current = false;
      setCalibrationSyncPulse(false);
    }
    return undefined;
  }, [isCredentialInputReady]);

  const generateRecoveryKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = new Uint8Array(32);
    window.crypto.getRandomValues(random);
    let result = '';
    for (let i = 0; i < 32; i++) {
      if (i > 0 && i % 8 === 0) result += '-';
      result += chars.charAt(random[i] % chars.length);
    }
    SecurityService.wipeSensitive(random);
    setRecoveryKey(result);
  };

  const handleGenerateCredential = () => {
    if (!validatePassword(password)) {
      setError(t.passwordRequirement);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    setError(null);
    setRecoveryKey('');
    setCredentialExportStatus('idle');
    setIssueFlash(false);
    setIsForgingCredential(true);
    window.setTimeout(() => {
      generateRecoveryKey();
      setIssueFlash(true);
      setIsForgingCredential(false);
      window.setTimeout(() => setIssueFlash(false), 900);
    }, 1300);
  };

  const handleNextStep = async () => {
    setError(null);
    if (!validatePassword(password)) {
      setError(t.passwordRequirement);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (!hasIssuedAccessPass) {
      setError(onboardingCopy.savePngFirst);
      return;
    }

    const recoveryHash = await SecurityService.hashRecoveryKey(recoveryKey);
    setStoredString(AppStorageKeys.recoveryVerifier, recoveryHash);
    onComplete(password, [], []);
  };

  const issueCredentialAsPng = async () => {
    if (!credentialCardRef.current) return;
    setCredentialExportStatus('rendering');
    try {
      const { domToBlob } = await import('modern-screenshot');
      const blob = await domToBlob(credentialCardRef.current, {
        type: 'image/png',
        scale: 2,
        backgroundColor: '#031318',
      });
      if (!blob) throw new Error('NO_ACCESS_PASS_IMAGE');
      downloadBlob(blob, sanitizeDownloadFilename(`VECTOR_ACCESS_PASS_${Date.now()}.png`));
      setCredentialExportStatus('success');
    } catch (err) {
      console.warn('Onboarding: credential PNG export failed', err);
      setCredentialExportStatus('error');
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 backdrop-blur-xl transition-colors duration-700 md:overflow-hidden ${isLight ? 'bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_82%_8%,rgba(124,110,246,0.12),transparent_34%),linear-gradient(135deg,#f7fcff,#eef7fb_48%,#f7f3ff)]' : 'bg-[#02020a]'}`}
    >
      {/* Phase 4.5 §D — inline noise SVG (see lib/noiseTexture.ts). */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={NOISE_BG_STYLE}></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full max-w-6xl overflow-hidden rounded-[30px] border p-0 transition-all duration-700 md:rounded-[42px] ${isLight ? 'border-cyan-500/16 bg-white/74 shadow-[0_28px_90px_rgba(33,80,120,0.16),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl' : 'border-cyan-300/18 bg-[#02070b] shadow-[0_28px_90px_rgba(0,0,0,0.46),0_0_88px_rgba(104,82,255,0.08)]'}`}
      >
        <div className="pointer-events-none absolute left-10 top-0 h-px w-44 bg-gradient-to-r from-transparent via-cyan-200/34 to-transparent" />
        <div className="pointer-events-none absolute right-16 bottom-0 h-px w-56 bg-gradient-to-r from-transparent via-cyan-300/24 to-transparent" />
        <div className="pointer-events-none absolute -left-16 top-16 h-36 w-36 rounded-full border border-cyan-300/10" />
        <div className="pointer-events-none absolute -right-20 bottom-24 h-44 w-44 rounded-full border border-indigo-300/10" />

        <div className="flex flex-col">
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="relative flex min-h-[calc(100svh-24px)] flex-col overflow-hidden px-4 py-5 md:h-[calc(100vh-28px)] md:min-h-[640px] md:max-h-[820px] md:px-8 md:py-6"
          >
            <div className={`absolute inset-0 ${isLight ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,250,253,0.78)_46%,rgba(245,242,255,0.86))]' : 'bg-[#020915]'}`} />
            <div className={`absolute inset-0 ${isLight ? 'bg-[radial-gradient(circle_at_48%_8%,rgba(34,211,238,0.16),transparent_18%),radial-gradient(circle_at_24%_28%,rgba(124,110,246,0.10),transparent_25%),radial-gradient(circle_at_76%_46%,rgba(0,175,200,0.10),transparent_30%),radial-gradient(circle_at_62%_86%,rgba(124,110,246,0.08),transparent_32%)]' : 'bg-[radial-gradient(circle_at_48%_8%,rgba(126,239,255,0.15),transparent_18%),radial-gradient(circle_at_24%_28%,rgba(139,92,246,0.16),transparent_25%),radial-gradient(circle_at_76%_46%,rgba(100,80,255,0.14),transparent_30%),radial-gradient(circle_at_62%_86%,rgba(168,85,247,0.10),transparent_32%),linear-gradient(180deg,rgba(4,20,36,0.14)_0%,rgba(7,18,42,0.52)_46%,rgba(0,5,12,0.92)_100%)]'}`} />
            <div className="absolute inset-0 opacity-[0.52]">
              <svg
                aria-hidden="true"
                viewBox="0 0 1000 700"
                preserveAspectRatio="none"
                className="h-full w-full"
              >
                <defs>
                  <linearGradient id="mindspace-line" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#7eefff" stopOpacity="0.14" />
                    <stop offset="48%" stopColor="#38c9ef" stopOpacity="0.46" />
                    <stop offset="100%" stopColor="#7b6dff" stopOpacity="0.22" />
                  </linearGradient>
                  <filter id="mindspace-glow">
                    <feGaussianBlur stdDeviation="2.8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <g
                  fill="none"
                  stroke="url(#mindspace-line)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                >
                  <motion.path
                    d="M-24 548 C44 512 82 486 152 530 S260 492 314 526 S378 412 442 438 S512 424 562 382 S636 430 650 444 S700 342 734 316 S786 378 812 386 S878 330 928 350 S986 374 1020 382"
                    initial={{ pathLength: 0, opacity: 0.12 }}
                    animate={{ pathLength: [0.08, 1, 1], opacity: [0.18, 0.82, 0.46] }}
                    transition={{
                      duration: 12,
                      repeat: Infinity,
                      repeatDelay: 4.6,
                      ease: 'easeInOut',
                    }}
                    opacity="0.82"
                    strokeWidth="1.55"
                  />
                  <motion.path
                    d="M-14 632 C62 592 108 552 186 596 S316 548 366 574 S486 526 546 554 S676 500 724 526 S814 454 870 472 S962 494 1012 474"
                    initial={{ pathLength: 0.12, opacity: 0.1 }}
                    animate={{ pathLength: [0.12, 0.86, 1], opacity: [0.1, 0.54, 0.28] }}
                    transition={{
                      duration: 15,
                      delay: 2.1,
                      repeat: Infinity,
                      repeatDelay: 5.4,
                      ease: 'easeInOut',
                    }}
                    opacity="0.54"
                    strokeWidth="0.95"
                  />
                  <motion.path
                    d="M30 452 C86 482 94 552 132 548 C194 542 192 410 252 398 C304 388 314 468 356 468 C418 468 402 344 460 334 C528 322 520 548 572 558 C626 568 634 386 690 374 C750 362 736 578 790 588 C846 598 846 438 904 426 C946 418 960 514 994 536"
                    animate={{ strokeDashoffset: [260, 0, -180], opacity: [0.22, 0.66, 0.34] }}
                    transition={{
                      duration: 18,
                      delay: 1.3,
                      repeat: Infinity,
                      repeatDelay: 3.8,
                      ease: 'easeInOut',
                    }}
                    opacity="0.66"
                    strokeDasharray="180 22 86 18 240"
                    strokeWidth="1.25"
                  />
                  <motion.path
                    d="M70 688 C112 630 118 548 154 530 C212 502 232 668 276 672 C344 678 346 428 402 414 C466 398 476 682 528 690 C596 700 604 470 650 444 C710 408 718 640 762 654 C830 674 838 366 892 342 C950 316 952 604 1010 638"
                    animate={{ strokeDashoffset: [0, -160, -320], opacity: [0.18, 0.42, 0.2] }}
                    transition={{
                      duration: 22,
                      delay: 4.8,
                      repeat: Infinity,
                      repeatDelay: 6.2,
                      ease: 'easeInOut',
                    }}
                    opacity="0.42"
                    strokeDasharray="120 20 220 34 150"
                    strokeWidth="0.82"
                  />
                  <motion.path
                    d="M-24 578 C92 520 144 440 252 398 C344 364 390 468 488 484 C588 500 632 342 734 316 C836 290 910 438 1012 474"
                    animate={{ strokeDashoffset: [120, 0, -90], opacity: [0.12, 0.28, 0.16] }}
                    transition={{
                      duration: 20,
                      delay: 7,
                      repeat: Infinity,
                      repeatDelay: 7,
                      ease: 'easeInOut',
                    }}
                    opacity="0.28"
                    strokeDasharray="260 46 180 38"
                    strokeWidth="0.72"
                  />
                  <motion.path
                    d="M-30 238 C16 214 42 218 84 206 C126 194 144 236 186 248 C232 262 242 190 282 184 C326 178 346 220 392 232 C434 244 442 176 484 160 C530 142 558 200 604 214 C654 228 662 152 708 146 C756 140 774 190 820 198 C892 210 944 170 1018 164"
                    animate={{ strokeDashoffset: [80, -70, -160], opacity: [0.08, 0.18, 0.1] }}
                    transition={{
                      duration: 25,
                      delay: 3.4,
                      repeat: Infinity,
                      repeatDelay: 8.5,
                      ease: 'easeInOut',
                    }}
                    opacity="0.18"
                    strokeDasharray="88 28 170 42 140"
                    strokeWidth="0.58"
                  />
                  <motion.path
                    d="M34 312 C98 288 110 256 172 248 C236 240 244 348 306 356 C374 364 390 238 456 230 C522 222 532 318 594 330 C658 342 678 224 742 216 C806 208 812 294 876 298 C930 302 964 270 1018 260"
                    animate={{ strokeDashoffset: [-40, -180, -280], opacity: [0.06, 0.16, 0.08] }}
                    transition={{
                      duration: 24,
                      delay: 9.2,
                      repeat: Infinity,
                      repeatDelay: 6.8,
                      ease: 'easeInOut',
                    }}
                    opacity="0.16"
                    strokeDasharray="150 34 116 24 180"
                    strokeWidth="0.64"
                  />
                </g>
                <g filter="url(#mindspace-glow)" fill="#b8fbff">
                  {[
                    [76, 502, 2.4, 0.38],
                    [152, 530, 2.1, 0.28],
                    [238, 474, 2.2, 0.32],
                    [314, 526, 2.6, 0.3],
                    [402, 414, 2.9, 0.44],
                    [488, 484, 2.4, 0.3],
                    [562, 382, 3.1, 0.46],
                    [650, 444, 2.4, 0.32],
                    [734, 316, 3.2, 0.5],
                    [812, 386, 2.2, 0.28],
                    [892, 342, 2.8, 0.36],
                    [88, 574, 2.1, 0.24],
                    [186, 596, 2.1, 0.22],
                    [272, 528, 2.2, 0.26],
                    [366, 574, 2.2, 0.24],
                    [458, 510, 2.5, 0.3],
                    [546, 554, 2.1, 0.22],
                    [638, 486, 2.5, 0.3],
                    [724, 526, 2.2, 0.24],
                    [828, 462, 2.4, 0.28],
                    [926, 500, 2.1, 0.22],
                    [252, 398, 2.7, 0.36],
                    [528, 690, 2.2, 0.2],
                    [84, 206, 1.7, 0.16],
                    [392, 232, 1.9, 0.18],
                    [708, 146, 1.8, 0.18],
                  ].map(([cx, cy, r, opacity], index) => (
                    <motion.circle
                      key={`${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={r}
                      initial={{ opacity: opacity * 0.45, r: r * 0.82 }}
                      animate={{
                        opacity: [
                          opacity * 0.42,
                          opacity,
                          opacity * 1.85,
                          opacity * 0.52,
                          opacity * 0.36,
                        ],
                        r: [r * 0.82, r, r * 1.38, r * 0.94, r * 0.86],
                      }}
                      transition={{
                        duration: 4.8 + ((index * 7) % 9) * 0.42,
                        delay: ((index * 13) % 27) * 0.31,
                        repeat: Infinity,
                        repeatDelay: 5.5 + ((index * 5) % 8) * 0.6,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </g>
              </svg>
            </div>
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_56%,rgba(126,239,255,0.18),transparent_18%),radial-gradient(circle_at_64%_70%,rgba(168,85,247,0.14),transparent_28%),radial-gradient(circle_at_34%_78%,rgba(134,239,172,0.10),transparent_24%)] mix-blend-screen"
              animate={{
                opacity: calibrationProgress > 0 ? 0.04 + calibrationProgress / 720 : 0.015,
                scale: isCredentialInputReady
                  ? [1, 1.02, 1]
                  : 1 + fulfilledCalibrationCount * 0.004,
              }}
              transition={{
                opacity: { duration: 0.5, ease: 'easeOut' },
                scale: { duration: 3.2, repeat: isCredentialInputReady ? Infinity : 0 },
              }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(126,239,255,0.014)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.012)_1px,transparent_1px)] bg-[size:72px_72px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(126,239,255,0.12)_0_1px,transparent_2px),radial-gradient(circle_at_74%_10%,rgba(168,85,247,0.14)_0_1px,transparent_2px),radial-gradient(circle_at_46%_36%,rgba(123,109,255,0.12)_0_1px,transparent_2px)]" />
            <div className={`absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b ${isLight ? 'from-white/42 via-transparent to-transparent' : 'from-black/10 via-transparent to-transparent'}`} />
            <div className={`absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t ${isLight ? 'from-cyan-50/62 via-white/18 to-transparent' : 'from-[#01030a]/62 via-[#06091a]/18 to-transparent'}`} />
            {onCancel && (
              <motion.button
                type="button"
                onClick={onCancel}
                aria-label={language === 'zh' ? '返回首页' : 'Back to cover'}
                className={`absolute left-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border backdrop-blur-md transition-all md:left-6 md:top-6 ${isLight ? 'border-cyan-600/18 bg-white/62 text-cyan-700 shadow-[0_10px_28px_rgba(33,80,120,0.10)] hover:border-cyan-600/34 hover:bg-white hover:text-cyan-900' : 'border-cyan-300/14 bg-black/10 text-cyan-300/72 shadow-[0_0_18px_rgba(0,200,232,0.06),inset_0_0_16px_rgba(168,85,247,0.04)] hover:border-cyan-200/34 hover:bg-cyan-300/8 hover:text-cyan-100 hover:shadow-[0_0_28px_rgba(0,200,232,0.12),0_0_22px_rgba(139,92,246,0.10)]'}`}
                whileHover={{ x: -2, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
            )}
            <div className="absolute right-4 top-4 z-30 font-mono uppercase tracking-widest">
              <button
                type="button"
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-[9px] opacity-45 backdrop-blur-md transition-all hover:opacity-100 ${
                  theme === 'light'
                    ? 'bg-white/36 text-cyan-700 hover:bg-white/58 hover:text-cyan-900'
                    : 'bg-black/12 text-cyan-300 hover:bg-black/26 hover:text-cyan-100'
                }`}
                aria-expanded={showLanguageMenu}
                aria-label={onboardingCopy.selectLanguage}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{language.toUpperCase()}</span>
              </button>
              <AnimatePresence>
                {showLanguageMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`absolute right-0 mt-2 w-36 border p-1 text-[9px] shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-md ${
                      theme === 'light'
                        ? 'border-cyan-500/20 bg-white/90 text-cyan-700'
                        : 'border-cyan-500/25 bg-black/72 text-cyan-500'
                    }`}
                  >
                    {(['zh', 'en', 'ja', 'ko', 'fr', 'es', 'de'] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          onSetLanguage(lang);
                          setShowLanguageMenu(false);
                        }}
                        className={`flex w-full items-center justify-between px-2 py-2 transition-all ${
                          language === lang
                            ? isLight
                              ? 'bg-cyan-500/12 text-cyan-800'
                              : 'bg-cyan-400/16 text-cyan-100'
                            : isLight
                              ? 'text-slate-500 hover:bg-cyan-500/8 hover:text-cyan-800'
                              : 'text-cyan-700 hover:bg-cyan-400/8 hover:text-cyan-200'
                        }`}
                      >
                        <span>{NATIVE_LANG_NAMES[lang]}</span>
                        {language === lang && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {isForgingCredential && (
                <motion.div
                  key="credential-energy"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
                >
                  {credentialParticles.map((particle, index) => (
                    <motion.span
                      key={index}
                      initial={{ y: -48, opacity: 0, scale: 0.7 }}
                      animate={{
                        y: 650,
                        opacity: [0, particle.opacity, 0],
                        scale: [0.7, 1, 0.85],
                      }}
                      transition={{
                        duration: Number.parseFloat(particle.duration),
                        delay: Number.parseFloat(particle.delay) / 6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      style={{ left: particle.left }}
                      className="absolute top-0 h-16 w-px bg-cyan-300 shadow-[0_0_16px_rgba(126,239,255,0.9)]"
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative z-20 mx-auto flex h-full w-full max-w-5xl flex-col justify-between gap-4 pb-20 text-center md:pb-0">
              <div className="flex flex-col items-center gap-1 pt-5 md:pt-7">
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent shadow-glow-cyan-400" />
                <h2 className={`text-xl font-mono uppercase tracking-widest md:text-[1.8rem] ${isLight ? 'text-slate-900' : 'text-cyan-50'}`}>
                  {onboardingCopy.title}
                </h2>
                <p className={`max-w-2xl text-xs leading-relaxed tracking-wide md:text-sm ${isLight ? 'text-slate-600' : 'text-cyan-100/72'}`}>
                  {onboardingCopy.subtitle}
                </p>
              </div>

              <div
                className={`relative w-full overflow-hidden rounded-[26px] border text-left backdrop-blur-md transition-all duration-500 ${hasIssuedAccessPass ? 'p-3 md:p-4' : 'p-4 md:p-5'} ${isLight ? 'border-cyan-600/18 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.10),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(124,110,246,0.09),transparent_32%),rgba(255,255,255,0.78)] shadow-[0_22px_70px_rgba(33,80,120,0.13),inset_0_1px_0_rgba(255,255,255,0.72)]' : 'border-cyan-200/40 bg-[radial-gradient(circle_at_18%_0%,rgba(126,239,255,0.12),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(168,85,247,0.13),transparent_32%),linear-gradient(135deg,rgba(5,29,39,0.88),rgba(5,7,24,0.76)_56%,rgba(7,18,38,0.9))] shadow-[0_24px_90px_rgba(0,0,0,0.38),0_0_18px_rgba(126,239,255,0.26),0_0_58px_rgba(34,211,238,0.16),0_0_110px_rgba(104,82,255,0.18),inset_0_0_32px_rgba(126,239,255,0.055),inset_0_1px_0_rgba(184,251,255,0.18)]'}`}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-cyan-100/12 shadow-[inset_0_0_28px_rgba(126,239,255,0.12)]" />
                <div className="pointer-events-none absolute -inset-px rounded-[27px] bg-[linear-gradient(120deg,rgba(126,239,255,0.34),transparent_24%,rgba(168,85,247,0.22)_62%,rgba(126,239,255,0.24))] opacity-30 blur-[2px]" />
                <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
                <div className="pointer-events-none absolute -left-24 top-8 h-40 w-40 rounded-full bg-cyan-300/5 blur-2xl" />
                <div className="mb-3 flex flex-wrap items-center gap-3 font-mono">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-cyan-500">
                    {hasIssuedAccessPass ? onboardingCopy.calibrated : onboardingCopy.calibrating}
                  </span>
                </div>

                {hasIssuedAccessPass ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="grid gap-2 md:grid-cols-3">
                      {[
                        {
                          label: onboardingCopy.passwordConfirmed,
                          value: onboardingCopy.accessLocked,
                        },
                        {
                          label: onboardingCopy.keyIssued,
                          value: onboardingCopy.plaintextNotStored,
                        },
                        {
                          label: onboardingCopy.ownership,
                          value: onboardingCopy.belongsToVessel,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-cyan-400/14 bg-black/24 px-3 py-2 shadow-[inset_0_1px_0_rgba(184,251,255,0.04)]"
                        >
                          <div className="text-[8px] uppercase tracking-[0.24em] text-cyan-700">
                            {item.label}
                          </div>
                          <div className="mt-1 text-[11px] font-bold tracking-widest text-cyan-100">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateCredential}
                      disabled={isForgingCredential}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/8 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200 transition-all hover:bg-cyan-400/16 disabled:cursor-wait disabled:opacity-65"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {onboardingCopy.reissue}
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className={`relative overflow-hidden bg-[radial-gradient(circle_at_18%_0%,rgba(126,239,255,0.05),transparent_34%),radial-gradient(circle_at_88%_96%,rgba(168,85,247,0.08),transparent_38%),rgba(0,3,12,0.08)] p-3 shadow-[inset_0_1px_0_rgba(184,251,255,0.035),0_0_30px_rgba(104,82,255,0.035)] md:p-5 ${
                        calibrationSyncPulse ? 'calibration-module--syncing' : ''
                      }`}
                    >
                      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/16 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent" />
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(126,239,255,0.13),transparent_22%),radial-gradient(circle_at_50%_94%,rgba(168,85,247,0.14),transparent_38%)]"
                        animate={{
                          opacity: 0.16 + fulfilledCalibrationCount * 0.08,
                        }}
                        transition={{ duration: 0.35 }}
                      />
                      {calibrationSyncPulse && (
                        <motion.div
                          aria-hidden="true"
                          className="pointer-events-none absolute left-1/2 top-[53%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/35 bg-cyan-200/10 shadow-[0_0_46px_rgba(126,239,255,0.28)]"
                          initial={{ opacity: 0, scale: 0.35 }}
                          animate={{ opacity: [0, 0.68, 0], scale: [0.35, 2.8, 4.6] }}
                          transition={{ duration: 0.86, ease: 'easeOut' }}
                        />
                      )}
                      <div className="pointer-events-none absolute left-[13%] right-[13%] top-[104px] hidden h-px bg-cyan-400/14 md:block" />
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-[13%] right-[13%] top-[104px] hidden h-px origin-left bg-gradient-to-r from-transparent via-cyan-200 to-transparent shadow-[0_0_18px_rgba(126,239,255,0.42)] md:block"
                        initial={false}
                        animate={{
                          scaleX: getPasswordStrength(password) / 100,
                          opacity: getPasswordStrength(password) > 0 ? 0.85 : 0.16,
                        }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                      />

                      <div className="relative z-10 grid gap-4 md:grid-cols-[1fr_72px_1fr] md:items-end">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-cyan-500/80">
                            {onboardingCopy.passwordLabel}
                          </label>
                          <div className="relative overflow-hidden rounded-[999px] border border-cyan-300/18 bg-[radial-gradient(ellipse_at_50%_50%,rgba(126,239,255,0.09),transparent_64%),radial-gradient(ellipse_at_86%_50%,rgba(168,85,247,0.08),transparent_52%),rgba(0,5,14,0.42)] shadow-[inset_0_0_28px_rgba(126,239,255,0.05),0_0_0_1px_rgba(104,82,255,0.04)] transition-all focus-within:border-cyan-200/50 focus-within:bg-black/38 focus-within:shadow-[inset_0_0_34px_rgba(126,239,255,0.09),0_0_26px_rgba(139,92,246,0.11)]">
                            <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-0 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent transition-all duration-500 focus-within:w-[84%]" />
                            <input
                              data-suppress-focus-ring="true"
                              data-testid="onboarding-password"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              disabled={isForgingCredential}
                              className="h-16 w-full rounded-[999px] border-0 bg-transparent px-6 pr-16 font-mono text-cyan-100 outline-none transition-all placeholder:text-cyan-900 focus:outline-none focus:ring-0 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
                              placeholder="********"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-cyan-400/12 bg-black/18 text-cyan-500 transition-colors hover:text-cyan-200"
                              aria-label={
                                showPassword
                                  ? onboardingCopy.hidePassword
                                  : onboardingCopy.showPassword
                              }
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div
                          aria-hidden="true"
                          className="relative hidden h-16 items-center justify-center md:flex"
                        >
                          <div className="absolute h-px w-full bg-cyan-500/16" />
                          <motion.div
                            className="grid h-9 w-9 place-items-center rounded-full border border-cyan-300/22 bg-cyan-300/6 shadow-[0_0_24px_rgba(0,200,232,0.08)]"
                            animate={{
                              boxShadow: isCredentialInputReady
                                ? [
                                    '0 0 18px rgba(0,200,232,0.12)',
                                    '0 0 34px rgba(126,239,255,0.34)',
                                    '0 0 18px rgba(0,200,232,0.12)',
                                  ]
                                : '0 0 18px rgba(0,200,232,0.08)',
                            }}
                            transition={{
                              duration: 2.4,
                              repeat: isCredentialInputReady ? Infinity : 0,
                              ease: 'easeInOut',
                            }}
                          >
                            <span
                              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                                isCredentialInputReady
                                  ? 'bg-green-300 shadow-[0_0_18px_rgba(134,239,172,0.9)]'
                                  : 'bg-cyan-900'
                              }`}
                            />
                          </motion.div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-cyan-500/80">
                            {onboardingCopy.confirmLabel}
                          </label>
                          <div className="relative overflow-hidden rounded-[999px] border border-cyan-300/18 bg-[radial-gradient(ellipse_at_50%_50%,rgba(126,239,255,0.09),transparent_64%),radial-gradient(ellipse_at_86%_50%,rgba(168,85,247,0.08),transparent_52%),rgba(0,5,14,0.42)] shadow-[inset_0_0_28px_rgba(126,239,255,0.05),0_0_0_1px_rgba(104,82,255,0.04)] transition-all focus-within:border-cyan-200/50 focus-within:bg-black/38 focus-within:shadow-[inset_0_0_34px_rgba(126,239,255,0.09),0_0_26px_rgba(139,92,246,0.11)]">
                            <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-0 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent transition-all duration-500 focus-within:w-[84%]" />
                            <input
                              data-suppress-focus-ring="true"
                              data-testid="onboarding-password-confirm"
                              type={showPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              disabled={isForgingCredential}
                              className="h-16 w-full rounded-[999px] border-0 bg-transparent px-6 font-mono text-cyan-100 outline-none transition-all placeholder:text-cyan-900 focus:outline-none focus:ring-0 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
                              placeholder="********"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 mt-7 px-1 pb-2 pt-4">
                        <svg
                          aria-hidden="true"
                          className="pointer-events-none absolute left-[6%] right-[6%] top-3 hidden h-14 w-[88%] overflow-visible md:block"
                          preserveAspectRatio="none"
                          viewBox="0 0 100 36"
                        >
                          <g
                            fill="none"
                            stroke="rgba(126,239,255,0.16)"
                            strokeLinecap="round"
                            strokeWidth="0.32"
                          >
                            <path d="M18 18 C16 13, 14 10, 11 8" />
                            <path d="M18 18 C15 22, 12 25, 8 27" />
                            <path d="M37 16 C36 11, 33 9, 30 7" />
                            <path d="M49 13 C52 9, 56 8, 60 7" />
                            <path d="M62 18 C65 23, 68 25, 72 26" />
                            <path d="M79 22 C81 28, 85 31, 89 33" />
                            <path d="M86 17 C89 13, 93 11, 97 9" />
                          </g>
                          <motion.g
                            fill="none"
                            stroke="url(#calibration-dendrite-flow)"
                            strokeLinecap="round"
                            strokeWidth="0.42"
                            initial={false}
                            animate={{
                              opacity: fulfilledCalibrationCount > 0 ? 0.72 : 0.08,
                              pathLength:
                                fulfilledCalibrationCount / calibrationRequirements.length,
                            }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                          >
                            <path d="M18 18 C16 13, 14 10, 11 8" />
                            <path d="M18 18 C15 22, 12 25, 8 27" />
                            <path d="M37 16 C36 11, 33 9, 30 7" />
                            <path d="M49 13 C52 9, 56 8, 60 7" />
                            <path d="M62 18 C65 23, 68 25, 72 26" />
                            <path d="M79 22 C81 28, 85 31, 89 33" />
                            <path d="M86 17 C89 13, 93 11, 97 9" />
                          </motion.g>
                          <path
                            d="M3 20 C 11 14, 17 17, 24 19 C 31 21, 34 14, 42 13 C 51 12, 54 18, 62 18 C 70 18, 75 24, 82 20 C 88 17, 91 11, 97 15"
                            fill="none"
                            stroke="rgba(8,145,178,0.26)"
                            strokeLinecap="round"
                            strokeWidth="0.55"
                          />
                          <motion.path
                            d="M3 20 C 11 14, 17 17, 24 19 C 31 21, 34 14, 42 13 C 51 12, 54 18, 62 18 C 70 18, 75 24, 82 20 C 88 17, 91 11, 97 15"
                            fill="none"
                            stroke="url(#calibration-neural-flow)"
                            strokeLinecap="round"
                            strokeWidth="0.78"
                            initial={false}
                            animate={{
                              pathLength:
                                fulfilledCalibrationCount / calibrationRequirements.length,
                              opacity: fulfilledCalibrationCount > 0 ? 0.92 : 0.12,
                            }}
                            transition={{ duration: 0.56, ease: 'easeOut' }}
                          />
                          <defs>
                            <linearGradient
                              id="calibration-neural-flow"
                              x1="0"
                              x2="1"
                              y1="0"
                              y2="0"
                            >
                              <stop offset="0%" stopColor="rgba(34,211,238,0.08)" />
                              <stop offset="48%" stopColor="rgba(165,243,252,0.86)" />
                              <stop offset="100%" stopColor="rgba(134,239,172,0.46)" />
                            </linearGradient>
                            <linearGradient
                              id="calibration-dendrite-flow"
                              x1="0"
                              x2="1"
                              y1="0"
                              y2="1"
                            >
                              <stop offset="0%" stopColor="rgba(126,239,255,0.10)" />
                              <stop offset="54%" stopColor="rgba(168,85,247,0.42)" />
                              <stop offset="100%" stopColor="rgba(165,243,252,0.46)" />
                            </linearGradient>
                          </defs>
                          <g fill="rgba(184,251,255,0.34)">
                            {[11, 30, 60, 72, 89, 97].map((cx, index) => (
                              <motion.circle
                                key={cx}
                                cx={cx}
                                cy={[8, 7, 7, 26, 33, 9][index]}
                                r="0.55"
                                animate={{
                                  opacity:
                                    fulfilledCalibrationCount > index % 5
                                      ? [0.24, 0.68, 0.32]
                                      : 0.14,
                                  scale:
                                    fulfilledCalibrationCount > index % 5 ? [0.8, 1.35, 0.9] : 1,
                                }}
                                transition={{
                                  duration: 2.8,
                                  delay: index * 0.22,
                                  repeat: fulfilledCalibrationCount > index % 5 ? Infinity : 0,
                                  ease: 'easeInOut',
                                }}
                              />
                            ))}
                          </g>
                        </svg>
                        <div className="pointer-events-none absolute inset-x-3 top-1 hidden h-16 bg-[radial-gradient(circle_at_12%_52%,rgba(126,239,255,0.10),transparent_8%),radial-gradient(circle_at_28%_42%,rgba(126,239,255,0.08),transparent_8%),radial-gradient(circle_at_44%_54%,rgba(168,85,247,0.08),transparent_8%),radial-gradient(circle_at_61%_40%,rgba(126,239,255,0.08),transparent_8%),radial-gradient(circle_at_78%_54%,rgba(126,239,255,0.08),transparent_8%),radial-gradient(circle_at_94%_44%,rgba(134,239,172,0.08),transparent_8%)] blur-[1px] md:block" />
                        <div
                          className="grid grid-cols-6 gap-x-0"
                          aria-label={onboardingCopy.calibrating}
                        >
                          {calibrationRequirements.map((req, index) => {
                            const isCurrentRequirement = index === currentCalibrationIndex;

                            return (
                              <motion.div
                                key={req.label}
                                title={
                                  index === 0
                                    ? language === 'zh'
                                      ? '8位及以上'
                                      : '8+ chars'
                                    : undefined
                                }
                                className={`group relative flex min-h-12 flex-col items-center justify-start gap-2 text-center text-[8px] font-mono transition-all sm:text-[9px] md:text-[10px] md:[&:nth-child(even)]:pt-3 ${
                                  req.met
                                    ? 'text-cyan-100'
                                    : isCurrentRequirement
                                      ? 'text-cyan-200'
                                      : 'text-cyan-800'
                                }`}
                                animate={
                                  calibrationSyncPulse && req.met
                                    ? {
                                        y: [0, -3, 0],
                                        opacity: [0.9, 1, 0.94],
                                        filter: [
                                          'drop-shadow(0 0 0 rgba(126,239,255,0))',
                                          'drop-shadow(0 0 16px rgba(126,239,255,0.42))',
                                          'drop-shadow(0 0 6px rgba(126,239,255,0.14))',
                                        ],
                                      }
                                    : req.met
                                      ? {
                                          y: [0, -1.5, 0],
                                          opacity: [0.86, 1, 0.92],
                                          filter: [
                                            'drop-shadow(0 0 0 rgba(126,239,255,0))',
                                            'drop-shadow(0 0 12px rgba(126,239,255,0.24))',
                                            'drop-shadow(0 0 4px rgba(126,239,255,0.1))',
                                          ],
                                        }
                                      : isCurrentRequirement
                                        ? {
                                            y: [0, -2, 0],
                                            opacity: [0.76, 1, 0.82],
                                            filter: [
                                              'drop-shadow(0 0 4px rgba(34,211,238,0.10))',
                                              'drop-shadow(0 0 16px rgba(34,211,238,0.34))',
                                              'drop-shadow(0 0 5px rgba(34,211,238,0.12))',
                                            ],
                                          }
                                        : {
                                            y: 0,
                                            filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))',
                                          }
                                }
                                transition={{
                                  duration: calibrationSyncPulse ? 0.7 : 2.6,
                                  delay: calibrationSyncPulse ? index * 0.04 : index * 0.08,
                                  repeat:
                                    (req.met || isCurrentRequirement) && !calibrationSyncPulse
                                      ? Infinity
                                      : 0,
                                  repeatDelay: 2.2 + index * 0.22,
                                  ease: 'easeInOut',
                                }}
                              >
                                <span
                                  className={`relative z-10 h-3 w-3 rounded-full border transition-all duration-300 before:absolute before:left-1/2 before:top-1/2 before:h-7 before:w-7 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:blur-md before:content-[''] ${
                                    req.met
                                      ? 'border-cyan-100 bg-cyan-200 shadow-[0_0_18px_rgba(126,239,255,0.82)] before:bg-cyan-300/6'
                                      : isCurrentRequirement
                                        ? 'border-cyan-200 bg-cyan-400/16 shadow-[0_0_18px_rgba(34,211,238,0.38)] before:bg-cyan-200/12'
                                        : 'border-cyan-700 bg-cyan-950/60 shadow-[0_0_8px_rgba(0,200,232,0.08)] before:bg-cyan-300/6'
                                  }`}
                                />
                                <span className="relative z-10 whitespace-nowrap leading-none tracking-[0.04em] md:tracking-[0.08em]">
                                  {req.label}
                                </span>
                                {index === 0 && (
                                  <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-300/22 bg-black/68 px-3 py-1 text-[9px] tracking-[0.12em] text-cyan-100 opacity-0 shadow-[0_0_20px_rgba(0,200,232,0.10)] backdrop-blur-md transition-all duration-200 group-hover:-top-9 group-hover:opacity-100">
                                    {language === 'zh' ? '8位及以上' : '8+ chars'}
                                  </span>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      onClick={handleGenerateCredential}
                      disabled={isForgingCredential || !isCredentialInputReady}
                      className="group relative mt-4 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-cyan-400/36 bg-cyan-400/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-cyan-100 transition-all hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:border-cyan-400/20 disabled:bg-cyan-400/5 disabled:text-cyan-300/58 md:w-auto md:px-6"
                      animate={{
                        opacity: isCredentialInputReady || isForgingCredential ? 1 : 0.72,
                        boxShadow:
                          isCredentialInputReady || isForgingCredential
                            ? [
                                '0 0 20px rgba(0,200,232,0.08)',
                                '0 0 38px rgba(126,239,255,0.26)',
                                '0 0 20px rgba(0,200,232,0.08)',
                              ]
                            : [
                                '0 0 12px rgba(0,200,232,0.04)',
                                '0 0 20px rgba(0,200,232,0.09)',
                                '0 0 12px rgba(0,200,232,0.04)',
                              ],
                      }}
                      whileHover={isCredentialInputReady ? { scale: 1.015 } : undefined}
                      whileTap={isCredentialInputReady ? { scale: 0.985 } : undefined}
                      transition={{
                        duration: isCredentialInputReady ? 2.5 : 3.6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-[-36%] w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-cyan-100/24 to-transparent"
                        animate={{
                          x: isCredentialInputReady || isForgingCredential ? ['0%', '430%'] : '0%',
                          opacity: isCredentialInputReady || isForgingCredential ? [0, 0.85, 0] : 0,
                        }}
                        transition={{
                          duration: 2.8,
                          repeat: isCredentialInputReady || isForgingCredential ? Infinity : 0,
                          repeatDelay: 1.2,
                          ease: 'easeInOut',
                        }}
                      />
                      <Sparkles className="relative z-10 h-4 w-4" />
                      <span className="relative z-10">{calibrationCtaLabel}</span>
                    </motion.button>
                  </>
                )}
              </div>

              <div className="min-h-[168px]">
                <AnimatePresence>
                  {recoveryKey && (
                    <motion.div
                      initial={{ opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="mx-auto w-full max-w-xl"
                    >
                      <div className="relative overflow-hidden rounded-[28px] border border-cyan-300/18 bg-[radial-gradient(circle_at_0%_0%,rgba(126,239,255,0.08),transparent_42%),rgba(0,5,9,0.58)] p-4 font-mono text-left shadow-[0_22px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(184,251,255,0.08)] backdrop-blur-md">
                        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-green-200/40 to-transparent" />
                        <AnimatePresence>
                          {issueFlash && (
                            <motion.div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(134,239,172,0.16),rgba(0,0,0,0.18)_42%,transparent_68%)] backdrop-blur-[1px]"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 0] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.9, ease: 'easeOut' }}
                            >
                              <div className="rounded-full border border-green-200/34 bg-black/38 px-5 py-2 text-[10px] uppercase tracking-[0.3em] text-green-200 shadow-[0_0_32px_rgba(134,239,172,0.22)]">
                                {onboardingCopy.generatedTitle}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <motion.div
                          aria-hidden="true"
                          className="pointer-events-none absolute right-5 top-5 h-12 w-12 rounded-full border border-green-200/24"
                          animate={{
                            scale: hasIssuedAccessPass ? [1, 1.18, 1] : [1, 1.08, 1],
                            opacity: hasIssuedAccessPass ? [0.45, 0.82, 0.45] : [0.26, 0.5, 0.26],
                            boxShadow: hasIssuedAccessPass
                              ? [
                                  '0 0 14px rgba(134,239,172,0.08)',
                                  '0 0 34px rgba(134,239,172,0.26)',
                                  '0 0 14px rgba(134,239,172,0.08)',
                                ]
                              : [
                                  '0 0 10px rgba(126,239,255,0.06)',
                                  '0 0 22px rgba(126,239,255,0.12)',
                                  '0 0 10px rgba(126,239,255,0.06)',
                                ],
                          }}
                          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <div className="flex items-start gap-3 text-cyan-200">
                          <div className="relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-green-300/24 bg-green-300/6 shadow-[0_0_22px_rgba(134,239,172,0.1)]">
                            <Fingerprint className="h-4 w-4 text-green-300" />
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.34em] text-cyan-400">
                              {hasIssuedAccessPass
                                ? onboardingCopy.savedTitle
                                : onboardingCopy.generatedTitle}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-cyan-100/72">
                              {hasIssuedAccessPass
                                ? onboardingCopy.savedBody
                                : onboardingCopy.generatedBody}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-[10px] uppercase tracking-[0.18em] md:grid-cols-3">
                          {[
                            [accessPassCopy.ownerLabel, accessPassCopy.ownerValue],
                            [
                              accessPassCopy.localTitle,
                              language === 'zh' ? '仅保存在本设备' : 'This device only',
                            ],
                            [
                              accessPassCopy.keyTitle,
                              language === 'zh' ? '忘记密令时使用' : 'For lost access',
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-full border border-cyan-400/14 bg-cyan-400/5 px-3 py-2 text-center"
                            >
                              <span className="text-cyan-700">{label}</span>
                              <span className="ml-2 text-cyan-100/78">{value}</span>
                            </div>
                          ))}
                        </div>
                        <motion.div
                          className="relative mt-3 overflow-hidden rounded-[22px] border border-cyan-400/14 bg-[#031318]/72 p-3 text-center shadow-[inset_0_0_28px_rgba(126,239,255,0.045)]"
                          animate={{
                            borderColor: hasIssuedAccessPass
                              ? 'rgba(134,239,172,0.28)'
                              : 'rgba(34,211,238,0.18)',
                            boxShadow: hasIssuedAccessPass
                              ? 'inset 0 0 30px rgba(134,239,172,0.06), 0 0 26px rgba(134,239,172,0.08)'
                              : 'inset 0 0 28px rgba(126,239,255,0.045), 0 0 18px rgba(0,200,232,0.04)',
                          }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/28 to-transparent" />
                          <div className="select-all break-all px-6 text-sm font-bold tracking-widest text-cyan-200 md:px-8 md:text-[15px]">
                            {recoveryKey}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(recoveryKey);
                            }}
                            className="absolute right-2 top-2 rounded-full p-1 text-cyan-700 transition-colors hover:text-cyan-300"
                            aria-label={onboardingCopy.copyKey}
                          >
                            <ArrowRight className="w-4 h-4 rotate-[-45deg]" />
                          </button>
                        </motion.div>
                        {!hasIssuedAccessPass ? (
                          <motion.button
                            type="button"
                            onClick={issueCredentialAsPng}
                            disabled={credentialExportStatus === 'rendering'}
                            className="relative mt-3 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-cyan-400/40 bg-cyan-400/12 px-4 py-4 text-sm uppercase tracking-[0.18em] text-cyan-100 transition-all hover:bg-cyan-400/20"
                            animate={{
                              boxShadow: [
                                '0 0 16px rgba(0,200,232,0.08)',
                                '0 0 30px rgba(126,239,255,0.18)',
                                '0 0 16px rgba(0,200,232,0.08)',
                              ],
                            }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/42 to-transparent" />
                            <Download className="relative z-10 h-4 w-4" />
                            <span className="relative z-10">
                              {credentialExportStatus === 'rendering'
                                ? onboardingCopy.savingPng
                                : onboardingCopy.savePng}
                            </span>
                          </motion.button>
                        ) : (
                          <div
                            data-testid="onboarding-recovery-saved"
                            className="mt-3 flex items-center gap-3 rounded-full border border-green-300/36 bg-green-300/8 p-3 text-cyan-100"
                          >
                            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-green-300 bg-green-300/70">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm uppercase tracking-widest">
                              {onboardingCopy.savedReady}
                            </span>
                          </div>
                        )}
                        {credentialExportStatus === 'error' && (
                          <div className="mt-2 text-[10px] text-rose-300">
                            {onboardingCopy.pngError}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-xs font-mono animate-pulse mt-2 drop-shadow-[0_0_5px_color-mix(in_srgb,_var(--color-rose-500)_30%,_transparent)]">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="fixed bottom-3 left-4 right-4 z-40 flex items-end gap-3 md:absolute md:bottom-4 md:left-auto md:right-5">
            <CyberButton
              data-testid="onboarding-next"
              onClick={handleNextStep}
              disabled={!isAccessPassReady}
              className={`w-full justify-center md:w-auto ${
                !isAccessPassReady ? 'cursor-not-allowed opacity-45 hover:bg-transparent' : ''
              }`}
              theme={theme}
            >
              {isAccessPassReady ? onboardingCopy.enter : onboardingCopy.locked}{' '}
              <ArrowRight className="ml-2 w-4 h-4" />
            </CyberButton>
          </div>
        </div>
      </motion.div>
      {recoveryKey && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 w-[960px] -translate-x-[120vw] font-mono"
        >
          <div
            ref={credentialCardRef}
            className="relative w-[960px] overflow-hidden border border-cyan-300/60 bg-[#031318] p-8 text-cyan-50 shadow-[0_0_64px_rgba(0,200,232,0.22)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(126,239,255,0.18),transparent_25%),radial-gradient(circle_at_12%_92%,rgba(123,109,255,0.18),transparent_28%),linear-gradient(135deg,rgba(6,22,42,0.95),rgba(0,32,36,0.95)_48%,rgba(0,8,12,0.98))]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(126,239,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(126,239,255,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
            <div className="absolute -right-14 top-10 h-64 w-64 rounded-full border border-cyan-300/18" />
            <div className="absolute bottom-0 left-0 h-48 w-72 bg-[radial-gradient(circle_at_20%_80%,rgba(80,120,255,0.22),transparent_68%)]" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-8">
                <div>
                  <div className="text-[13px] uppercase tracking-[0.42em] text-cyan-300">
                    VECTOR SPACE ACCESS PASS
                  </div>
                  <div className="mt-4 text-4xl font-bold tracking-widest text-cyan-50">
                    {accessPassCopy.title}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 border border-cyan-400/55 bg-cyan-400/8 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-cyan-200">
                    <span className="h-2 w-2 rounded-full bg-green-300 shadow-[0_0_16px_rgba(134,239,172,0.9)]" />
                    {accessPassCopy.detector}
                  </div>
                </div>
                <AccessPassDetectorSeal />
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4">
                {[
                  {
                    icon: HardDrive,
                    title: accessPassCopy.localTitle,
                    body: accessPassCopy.localBody,
                  },
                  {
                    icon: ShieldCheck,
                    title: accessPassCopy.encryptionTitle,
                    body: accessPassCopy.encryptionBody,
                  },
                  {
                    icon: KeyRound,
                    title: accessPassCopy.keyTitle,
                    body: accessPassCopy.keyBody,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="border border-cyan-400/35 bg-black/28 p-4">
                      <Icon className="h-5 w-5 text-cyan-300" />
                      <div className="mt-4 text-base font-bold tracking-widest text-cyan-50">
                        {item.title}
                      </div>
                      <div className="mt-2 text-xs leading-relaxed text-cyan-100/72">
                        {item.body}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border border-cyan-400/45 bg-black/35 p-5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-cyan-300">
                  <span>{accessPassCopy.keyLabel}</span>
                  <span>{accessPassCopy.keyLevel}</span>
                </div>
                <div className="mt-4 break-all text-center text-2xl font-bold tracking-[0.14em] text-cyan-100">
                  {recoveryKey}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-[1fr_180px] gap-4">
                <div className="border border-cyan-400/28 bg-cyan-950/18 p-4 text-xs leading-relaxed text-cyan-100/76">
                  <span className="font-bold text-cyan-300">{accessPassCopy.usageTitle}</span>
                  {accessPassCopy.usageBody}
                </div>
                <div className="flex flex-col justify-center border border-cyan-400/35 bg-black/24 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-400">
                    {accessPassCopy.ownerLabel}
                  </div>
                  <div className="mt-2 text-lg font-bold uppercase tracking-widest text-green-300">
                    {accessPassCopy.ownerValue}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-cyan-400/20 pt-4 text-[11px] uppercase tracking-[0.24em] text-cyan-300/72">
                {accessPassCopy.saveReminder}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes radar-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
