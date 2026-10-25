import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, User, ChevronDown, ChevronUp, ZoomIn, ZoomOut, RotateCcw, 
  Pencil, Crown, Plus, Move, Layers, Maximize2, Minimize2,
  Download, Printer, Check
} from 'lucide-react';
import type { Person } from '@/types';

interface Props {
  treeId: string;
  persons: Person[];
  isAdmin: boolean;
  onEditMember?: (person: Person) => void;
  onAddChild?: (parent: Person) => void;
}

interface TreeNode {
  person: Person;
  children: TreeNode[];
}

// Four sophisticated palettes in cohesive shades of blue
const bluePalettes = [
  // 1. Royal Blue (عشه)
  {
    dark: '#0f2b6e',
    primary: '#1d4ed8',
    light: '#eff6ff',
    border: '#93c5fd',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    tag: 'أزرق ملكي',
  },
  // 2. Ocean Sapphire (صالحه)
  {
    dark: '#0c4a6e',
    primary: '#0284c7',
    light: '#f0f9ff',
    border: '#7dd3fc',
    badgeBg: '#e0f2fe',
    badgeText: '#0369a1',
    tag: 'أزرق ياقوتي',
  },
  // 3. Deep Cobalt / Indigo (مهديم)
  {
    dark: '#1e1b4b',
    primary: '#2563eb',
    light: '#eef2ff',
    border: '#a5b4fc',
    badgeBg: '#e0e7ff',
    badgeText: '#1e40af',
    tag: 'أزرق كحلي',
  },
  // 4. Marine Cerulean (حسينه)
  {
    dark: '#164e63',
    primary: '#0891b2',
    light: '#ecfeff',
    border: '#67e8f9',
    badgeBg: '#cffafe',
    badgeText: '#0e7490',
    tag: 'أزرق بحري',
  },
];

export default function FamilyTreeChart({ treeId, persons, isAdmin, onEditMember, onAddChild }: Props) {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [layoutOrientation, setLayoutOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [zoomLevel, setZoomLevel] = useState<number>(0.9);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // References for dragging and export
  const canvasRef = useRef<HTMLDivElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // 1. Identify Root patriarch (الشيخ علي عيسى الزدجالي or person without parents)
  const rootPerson = useMemo(() => {
    return persons.find(p => p.full_name_ar.includes('الشيخ علي') || p.full_name_ar.includes('علي عيسى'))
      || persons.find(p => p.gender === 'male' && !p.father_id && !p.mother_id)
      || persons[0];
  }, [persons]);

  // 2. Identify the Wives
  const wives = useMemo(() => {
    if (!rootPerson) return [];
    const directWives = persons.filter(p => 
      p.gender === 'female' && 
      (p.spouse_id === rootPerson.id || 
       p.full_name_ar.includes('عشه') || 
       p.full_name_ar.includes('صالحه') || 
       p.full_name_ar.includes('مهدم') || 
       p.full_name_ar.includes('مهديم') || 
       p.full_name_ar.includes('حسينه'))
    );
    return directWives.sort((a, b) => {
      const order = ['عشه', 'صالحه', 'مهدم', 'مهديم', 'حسينه'];
      const idxA = order.findIndex(name => a.full_name_ar.includes(name));
      const idxB = order.findIndex(name => b.full_name_ar.includes(name));
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  }, [persons, rootPerson]);

  // Canonical ordering mapping to replicate the reference chart exactly
  const canonicalChildOrder: Record<string, string[]> = useMemo(() => ({
    'عشه': ['عبدالله', 'أحمد', 'صلاح', 'ناصر', 'صفية', 'صفيه'],
    'صالحه': ['سعود', 'محمد', 'هلال', 'فاطمه', 'زمزم', 'محفوظه'],
    'مهدم': ['عبداللطيف', 'خالد', 'محمود', 'سمير', 'سعيد', 'زبيده', 'مريم'],
    'مهديم': ['عبداللطيف', 'خالد', 'محمود', 'سمير', 'سعيد', 'زبيده', 'مريم'],
    'حسينه': ['سالم'],
    'عبدالله': ['سعيد', 'هلال', 'محفوظ', 'حنيفه', 'شيخوه', 'شمسه', 'زكيه'],
    'صفية': ['سيف', 'يونس', 'علي', 'فايزه'],
    'صفيه': ['سيف', 'يونس', 'علي', 'فايزه'],
    'ناصر': ['رشيد', 'حميده', 'فوزيه', 'أنيسة', 'رفيه'],
    'صلاح': ['سعيد', 'محفوظ', 'محمد', 'علي', 'فيصل', 'فوزيه', 'فريدة', 'حنان', 'إيمان', 'أمينه'],
    'أحمد': ['منير', 'نبيل', 'أمين', 'محمود', 'زينب', 'مريم', 'نوره', 'محفوظة'],
    'سعود': ['عادل', 'نبيل', 'طارق', 'علي', 'منيره', 'جمانه', 'عهد', 'أنيسة', 'خديجه', 'منى', 'شهد'],
    'محمد': ['باسمه', 'بثينه', 'صوغيه', 'عايشه', 'محمد', 'بشرى', 'خوله', 'أحمد'],
    'هلال': ['وليد', 'إيمان', 'عبدالعزيز', 'مها', 'شعاع'],
    'فاطمه': ['عبدالرحمن', 'مريم', 'أمينه'],
    'زمزم': ['طلال', 'أنور', 'خديجه', 'قيس', 'فيس'],
    'محفوظه': ['بشرى', 'عمر', 'صالح', 'خديجه', 'عمار', 'فاطمه', 'عبدالوهاب', 'مريم', 'صالحه'],
    'سالم': ['علي', 'عادل', 'محمد', 'عدنان', 'سلطان', 'عبدالله', 'سهيل', 'علياء', 'أسماء', 'مديحه', 'سميه'],
    'مريم': ['عمار', 'محمد', 'حمد', 'ماجده', 'منى', 'شمسه', 'فاطمه', 'أريج'],
    'زبيده': ['عصام', 'رشاد', 'علي', 'سهام', 'نوره', 'شيخه'],
    'سعيد': ['عمرو', 'محمد', 'أنس', 'أحمد'],
    'سمير': ['محمد', 'فلوله'],
    'محمود': ['معتصم', 'علي', 'ماجد', 'محمد', 'مزنه'],
    'خالد': ['عنود', 'تسنيم', 'فاطمه', 'علي', 'منتصر', 'وضاح'],
    'عبداللطيف': ['علي', 'محمد', 'عيسى', 'علياء', 'أسماء', 'عايشه', 'مريم', 'فاطمه', 'خديجه', 'ساره', 'عبدالله'],
    'فايزه': ['أحمد', 'إبراهيم', 'عبدالرحمن', 'صفية', 'صفيه', 'بشاير', 'شفيفه', 'غمنيه'],
    'رشيد': ['أنور', 'سارة', 'دينا', 'ماريا', 'نور'],
    'وليد': ['دانه', 'خالد', 'محمد'],
    'إيمان': ['سلطان', 'عبدالله', 'عبدالرحمن', 'أحمد'],
    'عبدالعزيز': ['مريم', 'هلال'],
    'مها': ['حلا', 'دانه', 'جوري', 'منى', 'زياد', 'يوسف'],
    'شعاع': ['حميد', 'حنين'],
    'عبدالرحمن': ['عمر', 'عهد', 'محمد', 'علي', 'سعود', 'جمال', 'منصور', 'علي', 'تركيه'],
    'طلال': ['أروى', 'أيه', 'أريج', 'أمنه', 'محمد', 'تميم'],
    'أنور': ['عمر', 'خالد'],
    'خديجه': ['نواف', 'أنور', 'شيث'],
    'قيس': ['ليث', 'عايشه', 'زينب', 'أدم', 'مريم'],
    'فيس': ['ليث', 'عايشه', 'زينب', 'أدم', 'مريم'],
  }), []);

  const sortChildren = (parentName: string, childrenList: Person[]): Person[] => {
    const key = Object.keys(canonicalChildOrder).find(k => parentName.includes(k));
    if (!key) return childrenList;
    const order = canonicalChildOrder[key];
    return [...childrenList].sort((a, b) => {
      const idxA = order.findIndex(name => a.full_name_ar.includes(name));
      const idxB = order.findIndex(name => b.full_name_ar.includes(name));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  };

  // 3. Build recursive descendants subtree
  const buildSubtree = (parentId: string, parentName: string, isMother: boolean = false): TreeNode[] => {
    const directChildren = persons.filter(p => 
      isMother ? p.mother_id === parentId : (p.father_id === parentId || p.mother_id === parentId)
    );
    const sorted = sortChildren(parentName, directChildren);

    return sorted.map(child => ({
      person: child,
      children: buildSubtree(child.id, child.full_name_ar, false),
    }));
  };

  // 4. Group tree by wives (or direct children if no wives registered)
  const wifeBranches = useMemo(() => {
    if (wives.length === 0 && rootPerson) {
      const directChildren = buildSubtree(rootPerson.id, rootPerson.full_name_ar, false);
      return [{
        wife: {
          id: 'direct',
          full_name_ar: 'الأبناء المباشرون',
          full_name_en: 'Direct Descendants',
          gender: 'female',
          is_alive: true,
        } as unknown as Person,
        childrenNodes: directChildren,
        totalCount: directChildren.length + 1,
      }];
    }

    return wives.map(wife => {
      let branchChildren = persons.filter(p => p.mother_id === wife.id);
      
      // Fallback for known branches
      if (branchChildren.length === 0 && wife.full_name_ar.includes('عشه')) {
        branchChildren = persons.filter(p => ['عبدالله', 'أحمد', 'صلاح', 'ناصر', 'صفيه', 'صفية'].some(n => p.full_name_ar.includes(n) && p.father_id === rootPerson?.id));
      } else if (branchChildren.length === 0 && wife.full_name_ar.includes('صالحه')) {
        branchChildren = persons.filter(p => ['سعود', 'محمد', 'هلال', 'فاطمه', 'زمزم', 'محفوظه'].some(n => p.full_name_ar.includes(n) && p.father_id === rootPerson?.id));
      } else if (branchChildren.length === 0 && (wife.full_name_ar.includes('مهدم') || wife.full_name_ar.includes('مهديم'))) {
        branchChildren = persons.filter(p => ['عبداللطيف', 'خالد', 'محمود', 'سمير', 'سعيد', 'زبيده', 'مريم'].some(n => p.full_name_ar.includes(n) && p.father_id === rootPerson?.id));
      } else if (branchChildren.length === 0 && wife.full_name_ar.includes('حسينه')) {
        branchChildren = persons.filter(p => p.full_name_ar.includes('سالم') && p.father_id === rootPerson?.id);
      }

      // Sort branch children by canonical order
      const sortedBranchChildren = sortChildren(wife.full_name_ar, branchChildren);

      const treeChildren = sortedBranchChildren.map(c => ({
        person: c,
        children: buildSubtree(c.id, c.full_name_ar, false),
      }));

      const countDescendants = (nodes: TreeNode[]): number => {
        return nodes.reduce((acc, curr) => acc + 1 + countDescendants(curr.children), 0);
      };

      const totalCount = 1 + countDescendants(treeChildren);

      return {
        wife,
        childrenNodes: treeChildren,
        totalCount,
      };
    });
  }, [wives, persons, rootPerson]);

  // Collect all collapsible nodes
  const allCollapsibleIds = useMemo(() => {
    const ids: string[] = [];
    const traverse = (node: TreeNode) => {
      if (node.children.length > 0) {
        ids.push(node.person.id);
        node.children.forEach(traverse);
      }
    };
    wifeBranches.forEach(b => {
      b.childrenNodes.forEach(traverse);
    });
    return ids;
  }, [wifeBranches]);

  // Keep Gen 2 children expanded so Gen 3 is visible in its neat vertical columns by default!
  useEffect(() => {
    const initialCollapsed = new Set<string>();
    wifeBranches.forEach(b => {
      b.childrenNodes.forEach(child => {
        // Leave Gen 2 expanded, collapse Gen 3+ if they have deeper children (Gen 4+)
        child.children.forEach(grandChild => {
          if (grandChild.children.length > 0) {
            initialCollapsed.add(grandChild.person.id);
            const collectDeep = (n: TreeNode) => {
              if (n.children.length > 0) {
                initialCollapsed.add(n.person.id);
                n.children.forEach(collectDeep);
              }
            };
            grandChild.children.forEach(collectDeep);
          }
        });
      });
    });
    setCollapsedNodes(initialCollapsed);
  }, [wifeBranches]);

  const toggleCollapse = (id: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => setCollapsedNodes(new Set());
  const handleCollapseAll = () => setCollapsedNodes(new Set(allCollapsibleIds));

  // Drag-to-pan handlers (Horizontal mode)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (layoutOrientation === 'vertical') return;
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    if (!canvasRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.pageX,
      y: e.pageY,
      scrollLeft: canvasRef.current.scrollLeft,
      scrollTop: canvasRef.current.scrollTop,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current || layoutOrientation === 'vertical') return;
    e.preventDefault();
    const dx = e.pageX - dragStart.x;
    const dy = e.pageY - dragStart.y;
    canvasRef.current.scrollLeft = dragStart.scrollLeft - dx;
    canvasRef.current.scrollTop = dragStart.scrollTop - dy;
  };

  const handleMouseUp = () => setIsDragging(false);

  // PDF Export Function (Unscaled High-DPI Capture)
  const handleExportPDF = async () => {
    if (!exportContainerRef.current) return;
    setExportingPdf(true);
    setPdfSuccess(false);

    const element = exportContainerRef.current;
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;

    try {
      // 1. Hide interactive controls (buttons, pills, capsules) during PDF generation
      element.classList.add('exporting-pdf');

      // 2. Wait for web fonts (e.g. Tajawal) to finish layout rendering
      if (document.fonts) {
        await document.fonts.ready;
      }

      // 3. Temporarily remove CSS scale transform so html2canvas captures full 100% native resolution
      element.style.transform = 'none';
      element.style.transition = 'none';

      // Allow browser to repaint at native unscaled size
      await new Promise(resolve => setTimeout(resolve, 120));

      // Dynamic import to keep initial bundle lightweight
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // 4. Capture at 3x resolution for ultra-sharp 300-DPI vector-grade text clarity
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Calculate realistic page dimensions in millimeters (1px at 96 DPI = 0.264583 mm)
      const widthMm = Math.max(297, (element.scrollWidth * 0.264583) + 20);
      const heightMm = Math.max(210, (element.scrollHeight * 0.264583) + 20);
      const isLandscape = widthMm >= heightMm;

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm],
        compress: true,
      });

      pdf.addImage(imgData, 'PNG', 10, 10, widthMm - 20, heightMm - 20, undefined, 'FAST');
      const safeName = (rootPerson?.full_name_ar || 'شجرة_العائلة').replace(/[\s/]/g, '_');
      pdf.save(`${safeName}_${layoutOrientation === 'horizontal' ? 'أفقي' : 'عمودي'}.pdf`);

      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      // Fallback: browser print dialog
      window.print();
    } finally {
      // 5. Restore original zoom transform and show controls again
      element.classList.remove('exporting-pdf');
      element.style.transform = originalTransform;
      element.style.transition = originalTransition;
      setExportingPdf(false);
    }
  };

  const filteredBranches = selectedBranch === 'all'
    ? wifeBranches
    : wifeBranches.filter((_, idx) => String(idx) === selectedBranch);

  return (
    <div className="card" style={{ overflow: 'hidden', border: '1.5px solid #bfdbfe', borderRadius: 'var(--radius-xl)', boxShadow: '0 10px 30px rgba(30, 58, 138, 0.08)' }}>
      {/* ======================================================== */}
      {/* TOP CONTROLS TOOLBAR */}
      {/* ======================================================== */}
      <div className="tree-toolbar-controls" style={{
        padding: '16px 20px',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        borderBottom: '1.5px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
      }}>
        {/* Left Side: Orientation Switcher + PDF Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Layout Orientation Switcher (أفقي / عمودي) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f1f5f9',
            padding: 3,
            borderRadius: 'var(--radius-full)',
            border: '1.5px solid #cbd5e1',
          }}>
            <button
              type="button"
              onClick={() => setLayoutOrientation('horizontal')}
              style={{
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                fontFamily: 'Tajawal, sans-serif',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: layoutOrientation === 'horizontal' ? '#1d4ed8' : 'transparent',
                color: layoutOrientation === 'horizontal' ? '#ffffff' : '#1e3a8a',
                boxShadow: layoutOrientation === 'horizontal' ? '0 2px 6px rgba(29, 78, 216, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="عرض الشجرة أفقياً بنظام المخطط الهيكلي"
            >
              <span>↔ عرض أفقي</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutOrientation('vertical')}
              style={{
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                fontFamily: 'Tajawal, sans-serif',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: layoutOrientation === 'vertical' ? '#1d4ed8' : 'transparent',
                color: layoutOrientation === 'vertical' ? '#ffffff' : '#1e3a8a',
                boxShadow: layoutOrientation === 'vertical' ? '0 2px 6px rgba(29, 78, 216, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="عرض الشجرة عمودياً بنظام القائمة الأنسابية المتسلسلة"
            >
              <span>↕ عرض عمودي</span>
            </button>
          </div>

          {/* Export to PDF Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="btn btn-sm"
            style={{
              borderRadius: 'var(--radius-full)',
              gap: 6,
              background: pdfSuccess ? '#10b981' : '#1d4ed8',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              padding: '6px 14px',
              boxShadow: '0 2px 8px rgba(29, 78, 216, 0.25)',
              transition: 'all 0.2s ease',
            }}
            title="تحميل شجرة العائلة كملف PDF عالي الجودة"
          >
            {exportingPdf ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#ffffff', borderTopColor: 'transparent' }} />
                <span>جاري إنشاء PDF...</span>
              </>
            ) : pdfSuccess ? (
              <>
                <Check size={15} />
                <span>تم حفظ الـ PDF!</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>حفظ كـ PDF</span>
              </>
            )}
          </button>

          {/* Print preview */}
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-sm btn-ghost"
            style={{ borderRadius: 'var(--radius-full)', gap: 5, color: '#475569', borderColor: '#cbd5e1' }}
            title="طباعة عبر الطابعة أو حفظ بنظام المتصفح"
          >
            <Printer size={14} />
            <span>طباعة</span>
          </button>
        </div>

        {/* Right Side: Tree Actions & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleExpandAll}
              className="btn btn-sm btn-ghost"
              style={{ borderRadius: 'var(--radius-full)', fontSize: '0.78rem', gap: 4, color: '#1e40af', borderColor: '#bfdbfe', background: '#eff6ff' }}
              title="توسيع كافة الفروع والأحفاد"
            >
              <Maximize2 size={13} /> توسيع الكل
            </button>
            <button
              onClick={handleCollapseAll}
              className="btn btn-sm btn-ghost"
              style={{ borderRadius: 'var(--radius-full)', fontSize: '0.78rem', gap: 4, color: '#475569', borderColor: '#cbd5e1' }}
              title="طي الفروع لتنظيم العرض"
            >
              <Minimize2 size={13} /> طي الفروع
            </button>
          </div>

          <div style={{ height: 24, width: 1, background: '#cbd5e1' }} />

          {/* Zoom controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: '#ffffff',
            padding: '3px 6px',
            borderRadius: 'var(--radius-full)',
            border: '1.5px solid #bfdbfe',
          }}>
            <button
              className="btn-icon"
              onClick={() => setZoomLevel(z => Math.max(0.35, Number((z - 0.1).toFixed(2))))}
              title="تصغير (Zoom Out)"
              style={{ width: 28, height: 28, color: '#1e40af' }}
            >
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, minWidth: 42, textAlign: 'center', color: '#1d4ed8', fontFamily: 'Outfit, sans-serif' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              className="btn-icon"
              onClick={() => setZoomLevel(z => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
              title="تكبير (Zoom In)"
              style={{ width: 28, height: 28, color: '#1e40af' }}
            >
              <ZoomIn size={15} />
            </button>
            <button
              className="btn-icon"
              onClick={() => setZoomLevel(layoutOrientation === 'horizontal' ? 0.9 : 1)}
              title="إعادة ضبط حجم العرض"
              style={{ width: 28, height: 28, color: '#64748b' }}
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Branch Filter Tabs Row */}
      <div className="tree-toolbar-controls" style={{
        padding: '10px 20px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={15} color="#1d4ed8" />
          تصفية الفروع:
        </span>
        <button
          onClick={() => setSelectedBranch('all')}
          className={`btn btn-sm ${selectedBranch === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ 
            borderRadius: 'var(--radius-full)',
            background: selectedBranch === 'all' ? '#1d4ed8' : '#ffffff',
            color: selectedBranch === 'all' ? '#ffffff' : '#1e3a8a',
            border: '1.5px solid #93c5fd',
            fontWeight: 700,
            fontSize: '0.78rem',
            padding: '3px 12px',
          }}
        >
          🌳 شجرة العائلة كاملة ({persons.length})
        </button>
        {wifeBranches.map((b, idx) => {
          const palette = bluePalettes[idx % bluePalettes.length];
          const isSelected = selectedBranch === String(idx);
          return (
            <button
              key={b.wife.id}
              onClick={() => setSelectedBranch(String(idx))}
              className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                borderRadius: 'var(--radius-full)',
                background: isSelected ? palette.primary : '#ffffff',
                borderColor: palette.border,
                color: isSelected ? '#ffffff' : palette.dark,
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '3px 12px',
                boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
              }}
            >
              👰 فرع {b.wife.full_name_ar.split(' ')[0]} ({b.totalCount})
            </button>
          );
        })}
      </div>

      {/* Info & Mouse Zoom Hint Bar */}
      <div className="tree-toolbar-controls" style={{
        background: '#eff6ff',
        padding: '7px 20px',
        borderBottom: '1px solid #dbeafe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: '#1e40af',
        fontFamily: 'Tajawal, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Move size={14} color="#1d4ed8" />
          <span><b>تحكّم بالشاشة:</b> يمكنك التكبير والتصغير باستخدام أزرار التحكم (+ / -)، والنقر والسحب بالماوس لتحريك الشجرة بحرية.</span>
        </div>
        <span style={{ color: '#2563eb', fontWeight: 800 }}>
          {layoutOrientation === 'horizontal' ? 'مخطط هيكلي أفقي' : 'شجرة أنساب عمودية'}
        </span>
      </div>

      {/* ======================================================== */}
      {/* CANVAS CONTAINER (EXPORT TARGET) */}
      {/* ======================================================== */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="tree-canvas-viewport"
        style={{
          position: 'relative',
          overflowX: 'auto',
          overflowY: 'auto',
          padding: '50px 30px',
          background: 'radial-gradient(#93c5fd 1.2px, #f8faff 1.2px)',
          backgroundSize: '24px 24px',
          minHeight: 650,
          cursor: layoutOrientation === 'horizontal' ? (isDragging ? 'grabbing' : 'grab') : 'default',
          userSelect: isDragging ? 'none' : 'auto',
          direction: 'rtl',
        }}
      >
        {/* Floating Canvas Quick Zoom Controls */}
        <div
          className="chart-interactive-control no-print"
          style={{
            position: 'sticky',
            top: 10,
            right: 14,
            zIndex: 30,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1.5px solid #bfdbfe',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 6px 20px rgba(30, 58, 138, 0.14)',
            padding: '4px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            float: 'right',
          }}
        >
          <button
            type="button"
            onClick={() => setZoomLevel(z => Math.max(0.3, Number((z - 0.1).toFixed(2))))}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: '#eff6ff',
              color: '#1d4ed8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="تصغير الشجرة"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(layoutOrientation === 'horizontal' ? 0.9 : 1)}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#1e3a8a',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              padding: '2px 6px',
              fontFamily: 'Outfit, sans-serif',
            }}
            title="إعادة ضبط حجم العرض (100%)"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(z => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: '#1d4ed8',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="تكبير الشجرة"
          >
            <ZoomIn size={15} />
          </button>
          <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 2px' }} />
          <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
            🔍 التحكم في التكبير من الأيقونات
          </span>
        </div>
        <div
          ref={exportContainerRef}
          className="tree-export-root"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '100%',
            padding: '24px',
            background: 'transparent',
          }}
        >
          {/* ======================================================== */}
          {/* ROOT PATRIARCH (الجد الأكبر - أعلى المخطط) */}
          {/* ======================================================== */}
          {rootPerson && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {/* Patriarch Card */}
              <div style={{
                background: 'linear-gradient(135deg, #0b1f4c 0%, #173b8a 50%, #1e40af 100%)',
                color: '#ffffff',
                padding: '16px 26px',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 16px 36px rgba(15, 43, 110, 0.28), 0 0 0 3px #60a5fa',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                minWidth: 300,
                position: 'relative',
              }}>
                {/* Photo or Avatar Icon */}
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2.5px solid rgba(255,255,255,0.45)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                }}>
                  {rootPerson.photo_url ? (
                    <img
                      src={rootPerson.photo_url}
                      alt={rootPerson.full_name_ar}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <User size={26} color="#ffffff" />
                  )}
                </div>

                <div style={{ textAlign: 'right', flex: 1 }}>
                  <Link
                    to={`/trees/${treeId}/member/${rootPerson.id}`}
                    style={{
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontWeight: 800,
                      fontSize: '1.25rem',
                      fontFamily: 'Tajawal, sans-serif',
                      display: 'block',
                      lineHeight: 1.35,
                    }}
                  >
                    {rootPerson.full_name_ar}
                  </Link>
                  <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: 2 }}>
                    مؤسس شجرة العائلة الكريمة
                  </div>
                </div>

                {/* Admin action buttons */}
                {isAdmin && (
                  <div
                    className="chart-interactive-control no-print"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(4px)',
                      padding: '3px 6px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    {onAddChild && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddChild(rootPerson); }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#ffffff',
                          color: '#1e3a8a',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                          transition: 'transform 0.1s ease',
                        }}
                        title="إضافة أبناء أو زوجات للجد الأكبر"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                    {onEditMember && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditMember(rootPerson); }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(255, 255, 255, 0.85)',
                          color: '#1e3a8a',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                          transition: 'transform 0.1s ease',
                        }}
                        title="تعديل بيانات الجد الأكبر"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Vertical connector stem from Patriarch */}
              <div style={{ width: 3, height: 36, background: '#1d4ed8' }} />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW MODE A: HORIZONTAL CANVA-STYLE ORG CHART */}
          {/* ======================================================== */}
          {layoutOrientation === 'horizontal' ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              position: 'relative',
              direction: 'ltr',
              gap: 16,
            }}>
              {filteredBranches.map((branch, branchIndex) => {
                const palette = bluePalettes[branchIndex % bluePalettes.length];
                const isFirstBranch = branchIndex === 0;
                const isLastBranch = branchIndex === filteredBranches.length - 1;
                const isOnlyBranch = filteredBranches.length === 1;

                return (
                  <div
                    key={branch.wife.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                      padding: '0 8px',
                    }}
                  >
                    {/* Top Horizontal bus line connecting the wives */}
                    {!isOnlyBranch && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        height: 3,
                        background: '#1d4ed8',
                        left: isFirstBranch ? '50%' : 0,
                        right: isLastBranch ? '50%' : 0,
                      }} />
                    )}

                    {/* Vertical drop into Wife card */}
                    <div style={{ width: 3, height: 28, background: palette.primary }} />

                    {/* WIFE CARD (Organized Horizontal Block in Blue Shade) */}
                    <div style={{
                      background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.dark} 100%)`,
                      color: '#ffffff',
                      borderRadius: 'var(--radius-xl)',
                      border: `2px solid ${palette.border}`,
                      boxShadow: '0 8px 24px rgba(30, 58, 138, 0.16)',
                      padding: '12px 16px',
                      minWidth: 190,
                      maxWidth: 230,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'center',
                      position: 'relative',
                      direction: 'rtl',
                    }}>
                      {/* Top Branch Count Tag */}
                      <div
                        className="chart-print-hidden no-print"
                        style={{
                          background: 'rgba(255, 255, 255, 0.20)',
                          color: '#ffffff',
                          border: '1px solid rgba(255, 255, 255, 0.35)',
                          padding: '2px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                        }}>
                        <span>{branch.totalCount} فرد</span>
                      </div>

                      {/* Wife Photo and Name */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' }}>
                        {branch.wife.id !== 'direct' && (
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.22)',
                            border: '1.5px solid rgba(255, 255, 255, 0.45)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}>
                            {branch.wife.photo_url ? (
                              <img
                                src={branch.wife.photo_url}
                                alt={branch.wife.full_name_ar}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <User size={18} color="#ffffff" />
                            )}
                          </div>
                        )}
                        <div style={{ textAlign: branch.wife.id === 'direct' ? 'center' : 'right' }}>
                          {branch.wife.id === 'direct' ? (
                            <div
                              style={{
                                fontFamily: 'Tajawal, sans-serif',
                                fontWeight: 800,
                                fontSize: '1.05rem',
                                color: '#ffffff',
                                lineHeight: 1.35,
                                wordBreak: 'break-word',
                              }}
                            >
                              {branch.wife.full_name_ar}
                            </div>
                          ) : (
                            <Link
                              to={`/trees/${treeId}/member/${branch.wife.id}`}
                              style={{
                                fontFamily: 'Tajawal, sans-serif',
                                fontWeight: 800,
                                fontSize: '1.05rem',
                                color: '#ffffff',
                                textDecoration: 'none',
                                display: 'block',
                                lineHeight: 1.35,
                                wordBreak: 'break-word',
                              }}
                            >
                              {branch.wife.full_name_ar}
                            </Link>
                          )}
                          <div style={{ fontSize: '0.74rem', color: '#e0f2fe', marginTop: 2 }}>
                            {branch.childrenNodes.length} من الأبناء المباشرين
                          </div>
                        </div>
                      </div>

                      {/* Sleek Admin Action Buttons Capsule */}
                      {isAdmin && (
                        <div
                          className="chart-interactive-control no-print"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(4px)',
                            padding: '2px 5px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            marginTop: 1,
                          }}
                        >
                          {onAddChild && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (branch.wife.id === 'direct') {
                                  if (rootPerson) onAddChild(rootPerson);
                                } else {
                                  onAddChild(branch.wife);
                                }
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#ffffff',
                                color: palette.primary,
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              }}
                              title={branch.wife.id === 'direct' ? "إضافة أبناء للجد الأكبر" : "إضافة أبناء لهذه الزوجة"}
                            >
                              <Plus size={12} />
                            </button>
                          )}
                          {onEditMember && branch.wife.id !== 'direct' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditMember(branch.wife); }}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(255, 255, 255, 0.85)',
                                color: palette.dark,
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              }}
                              title="تعديل بيانات الزوجة"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Spine-and-Branch Hierarchy under Wife (Matching user's diagram) */}
                    {branch.childrenNodes.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        position: 'relative',
                        alignSelf: 'flex-start',
                        marginTop: 0,
                      }}>
                        {/* Stepped connector from center of Wife card to Level 3 spine */}
                        <div style={{ position: 'relative', width: '100%', height: 24, minWidth: 120 }}>
                          {/* Vertical line down from center of Wife */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 80,
                            width: 2,
                            height: 14,
                            background: palette.primary,
                          }} />
                          {/* Horizontal step left to spine */}
                          <div style={{
                            position: 'absolute',
                            top: 14,
                            left: 10,
                            width: 72,
                            height: 2,
                            background: palette.primary,
                          }} />
                          {/* Vertical drop into spine */}
                          <div style={{
                            position: 'absolute',
                            top: 14,
                            left: 10,
                            width: 2,
                            height: 10,
                            background: palette.primary,
                          }} />
                        </div>

                        {/* Generation 3 Spine Column */}
                        <SpineColumn
                          nodes={branch.childrenNodes}
                          treeId={treeId}
                          isAdmin={isAdmin}
                          onEditMember={onEditMember}
                          onAddChild={onAddChild}
                          collapsedNodes={collapsedNodes}
                          toggleCollapse={toggleCollapse}
                          depth={3}
                          palette={palette}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ======================================================== */
            /* VIEW MODE B: VERTICAL GENEALOGICAL HIERARCHY */
            /* ======================================================== */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: 900,
              gap: 28,
            }}>
              {filteredBranches.map((branch, branchIndex) => {
                const palette = bluePalettes[branchIndex % bluePalettes.length];

                return (
                  <div
                    key={branch.wife.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      width: '100%',
                      background: '#ffffff',
                      borderRadius: 'var(--radius-xl)',
                      border: `2px solid ${palette.border}`,
                      boxShadow: '0 8px 24px rgba(30, 58, 138, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Wife Header Bar */}
                    <div style={{
                      background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.dark} 100%)`,
                      color: '#ffffff',
                      padding: '14px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                        }}>
                          👰
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {branch.wife.id === 'direct' ? (
                              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Tajawal, sans-serif' }}>
                                {branch.wife.full_name_ar}
                              </span>
                            ) : (
                              <Link
                                to={`/trees/${treeId}/member/${branch.wife.id}`}
                                style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Tajawal, sans-serif' }}
                              >
                                {branch.wife.full_name_ar}
                              </Link>
                            )}
                            {branch.wife.id !== 'direct' && (
                              <span
                                className="chart-print-hidden no-print"
                                style={{
                                  background: '#fdf2f8',
                                  color: '#db2777',
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                }}>
                                أنثى
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#e0f2fe', marginTop: 2 }}>
                            {branch.wife.id === 'direct' ? 'الأبناء المباشرون' : `الزوجة ${branchIndex + 1}`} • إجمالي الفرع: {branch.totalCount} فرد
                          </div>
                        </div>
                      </div>

                      {/* Admin buttons for wife */}
                      {isAdmin && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          background: 'rgba(255, 255, 255, 0.2)',
                          padding: '3px 6px',
                          borderRadius: 'var(--radius-full)',
                        }}>
                          {onAddChild && (
                            <button
                              onClick={() => {
                                if (branch.wife.id === 'direct') {
                                  if (rootPerson) onAddChild(rootPerson);
                                } else {
                                  onAddChild(branch.wife);
                                }
                              }}
                              style={{ width: 26, height: 26, borderRadius: '50%', background: '#ffffff', color: palette.primary, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={branch.wife.id === 'direct' ? "إضافة أبناء للجد الأكبر" : "إضافة أبناء لهذه الزوجة"}
                            >
                              <Plus size={13} />
                            </button>
                          )}
                          {onEditMember && branch.wife.id !== 'direct' && (
                            <button
                              onClick={() => onEditMember(branch.wife)}
                              style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', color: palette.dark, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="تعديل بيانات الزوجة"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Vertical Descendants Tree */}
                    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {branch.childrenNodes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '16px', fontSize: '0.9rem' }}>
                          لا يوجد أبناء مسجلين في هذا الفرع بعد
                        </div>
                      ) : (
                        branch.childrenNodes.map(childNode => (
                          <VerticalTreeNode
                            key={childNode.person.id}
                            node={childNode}
                            treeId={treeId}
                            isAdmin={isAdmin}
                            onEditMember={onEditMember}
                            onAddChild={onAddChild}
                            collapsedNodes={collapsedNodes}
                            toggleCollapse={toggleCollapse}
                            depth={3}
                            palette={palette}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ======================================================== */}
          {/* ORNAMENTAL TITLE & BRANCHES LEGEND (Matches Reference Chart) */}
          {/* ======================================================== */}
          <div
            className="chart-print-hidden no-print"
            style={{
              marginTop: 44,
            alignSelf: layoutOrientation === 'horizontal' ? 'flex-start' : 'center',
            padding: '16px 22px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '2px solid #93c5fd',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 6px 20px rgba(30, 58, 138, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            direction: 'rtl',
            minWidth: 280,
            maxWidth: 360,
          }}>
            <div style={{ textAlign: 'center', borderBottom: '1.5px solid #dbeafe', paddingBottom: 8 }}>
              <div style={{ fontSize: '1.6rem', marginBottom: 2 }}>🌳</div>
              <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: '#1e3a8a', lineHeight: 1.3 }}>
                شجرة عائلة
              </div>
              <div style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: '#0f172a' }}>
                {rootPerson?.full_name_ar || 'الشيخ علي عيسى الزدجالي'}
              </div>
            </div>
            {/* Wives Color Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.80rem', fontFamily: 'Tajawal, sans-serif' }}>
              {wives.map((w, idx) => {
                const palette = bluePalettes[idx % bluePalettes.length];
                const wifeLabels = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'];
                return (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 13, borderRadius: 3, background: palette.primary, border: `1px solid ${palette.dark}`, flexShrink: 0 }} />
                    <span style={{ color: '#1e293b', fontWeight: 700 }}>
                      الزوجة {wifeLabels[idx] || `${idx + 1}`} - {w.full_name_ar}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// =========================================================================
// COMPONENT 1: SPINE & BRANCH HIERARCHICAL TREE (Exact Match to User Schematic)
// =========================================================================
interface SpineColumnProps {
  nodes: TreeNode[];
  treeId: string;
  isAdmin: boolean;
  onEditMember?: (person: Person) => void;
  onAddChild?: (parent: Person) => void;
  collapsedNodes: Set<string>;
  toggleCollapse: (id: string) => void;
  depth: number;
  palette: typeof bluePalettes[0];
}

interface SpineNodeProps {
  node: TreeNode;
  treeId: string;
  isAdmin: boolean;
  onEditMember?: (person: Person) => void;
  onAddChild?: (parent: Person) => void;
  collapsedNodes: Set<string>;
  toggleCollapse: (id: string) => void;
  depth: number;
  palette: typeof bluePalettes[0];
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
}

function SpineColumn({
  nodes,
  treeId,
  isAdmin,
  onEditMember,
  onAddChild,
  collapsedNodes,
  toggleCollapse,
  depth,
  palette,
}: SpineColumnProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {nodes.map((node, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === nodes.length - 1;
        const isOnly = nodes.length === 1;

        return (
          <SpineNode
            key={node.person.id}
            node={node}
            treeId={treeId}
            isAdmin={isAdmin}
            onEditMember={onEditMember}
            onAddChild={onAddChild}
            collapsedNodes={collapsedNodes}
            toggleCollapse={toggleCollapse}
            depth={depth}
            palette={palette}
            isFirst={isFirst}
            isLast={isLast}
            isOnly={isOnly}
          />
        );
      })}
    </div>
  );
}

function SpineNode({
  node,
  treeId,
  isAdmin,
  onEditMember,
  onAddChild,
  collapsedNodes,
  toggleCollapse,
  depth,
  palette,
  isFirst,
  isLast,
  isOnly,
}: SpineNodeProps) {
  const { person, children } = node;
  const isCollapsed = collapsedNodes.has(person.id);
  const hasChildren = children.length > 0;
  const isMale = person.gender === 'male';
  const isParent = hasChildren;
  const CONNECTOR_Y = 27;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      position: 'relative',
      paddingBottom: 10,
    }}>
      {/* Vertical Spine Gutter on the Left */}
      <div style={{
        width: 22,
        alignSelf: 'stretch',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Top spine line (runs from top down to CONNECTOR_Y) */}
        {(!isFirst || depth === 3) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 10,
            width: 2,
            height: CONNECTOR_Y + 1,
            background: palette.primary,
          }} />
        )}

        {/* Bottom spine line (runs from CONNECTOR_Y down to bottom to meet next sibling) */}
        {!isLast && (
          <div style={{
            position: 'absolute',
            top: CONNECTOR_Y,
            bottom: 0,
            left: 10,
            width: 2,
            background: palette.primary,
          }} />
        )}

        {/* Horizontal branch line entering this card */}
        <div style={{
          position: 'absolute',
          top: CONNECTOR_Y,
          left: 10,
          right: 0,
          height: 2,
          background: palette.primary,
        }} />
      </div>

      {/* The Person Card (Rounded Rectangle matching user diagram) */}
      <div
        className="spine-person-card"
        style={{
          width: 144,
          minHeight: 54,
          background: isMale ? '#ffffff' : '#fffbfc',
          borderRadius: 8,
          border: isParent
            ? `2px solid ${palette.primary}`
            : `1.5px solid ${isMale ? palette.border : '#fbcfe8'}`,
          boxShadow: isParent
            ? '0 3px 10px rgba(30, 58, 138, 0.10)'
            : '0 1px 4px rgba(0, 0, 0, 0.04)',
          padding: '6px 8px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          direction: 'rtl',
          textAlign: 'right',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {/* Admin Controls (Pencil and Add) */}
        {isAdmin && (
          <div
            className="chart-interactive-control no-print"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '100%',
              marginBottom: 4,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                background: 'rgba(241, 245, 249, 0.95)',
                padding: '1px 3px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid #cbd5e1',
              }}
            >
              {onAddChild && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddChild(person); }}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: palette.primary,
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title="إضافة أبناء"
                >
                  <Plus size={10} />
                </button>
              )}
              {onEditMember && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEditMember(person); }}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title="تعديل البيانات"
                >
                  <Pencil size={9} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Person Photo & Full Arabic Name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        }}>
          {/* Circular Photo from Camera Roll or clean avatar */}
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: isMale ? '#e0f2fe' : '#fdf2f8',
            border: `1.5px solid ${isMale ? '#93c5fd' : '#fbcfe8'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            {person.photo_url ? (
              <img
                src={person.photo_url}
                alt={person.full_name_ar}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={18} color={isMale ? '#0284c7' : '#db2777'} />
            )}
          </div>

          {/* Full Arabic Name */}
          <Link
            to={`/trees/${treeId}/member/${person.id}`}
            style={{
              fontFamily: 'Tajawal, sans-serif',
              fontWeight: 800,
              fontSize: '0.88rem',
              color: '#0f172a',
              textDecoration: 'none',
              lineHeight: 1.35,
              textAlign: 'right',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              flex: 1,
            }}
            title={person.full_name_ar}
          >
            {person.full_name_ar}
          </Link>
        </div>

        {/* Expand/Collapse Toggle Button (if has children) */}
        {hasChildren && (
          <button
            className="chart-interactive-control no-print"
            onClick={() => toggleCollapse(person.id)}
            style={{
              position: 'absolute',
              bottom: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              background: isCollapsed ? '#eff6ff' : palette.primary,
              color: isCollapsed ? palette.primary : '#ffffff',
              border: `1.5px solid ${palette.border}`,
              borderRadius: 'var(--radius-full)',
              padding: '1px 7px',
              fontSize: '0.62rem',
              fontFamily: 'Tajawal, sans-serif',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              zIndex: 2,
              whiteSpace: 'nowrap',
            }}
            title={isCollapsed ? 'توسيع عرض الأبناء' : 'طي عرض الأبناء'}
          >
            <span>{children.length} {children.length === 1 ? 'ابن' : 'أبناء'}</span>
            {isCollapsed ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
          </button>
        )}
      </div>

      {/* Descendants (Level 4, Level 5, etc.) branching to the right */}
      {hasChildren && !isCollapsed && (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Horizontal connector from Card to Children Spine */}
          <div style={{
            width: 20,
            height: 2,
            background: palette.primary,
            marginTop: CONNECTOR_Y,
          }} />

          {/* Recursive SpineColumn for Children */}
          <SpineColumn
            nodes={children}
            treeId={treeId}
            isAdmin={isAdmin}
            onEditMember={onEditMember}
            onAddChild={onAddChild}
            collapsedNodes={collapsedNodes}
            toggleCollapse={toggleCollapse}
            depth={depth + 1}
            palette={palette}
          />
        </div>
      )}
    </div>
  );
}

// =========================================================================
// COMPONENT 2: RECURSIVE VERTICAL TREE NODE (Classical Genealogical Hierarchy)
// =========================================================================
interface VerticalNodeProps {
  node: TreeNode;
  treeId: string;
  isAdmin: boolean;
  onEditMember?: (person: Person) => void;
  onAddChild?: (parent: Person) => void;
  collapsedNodes: Set<string>;
  toggleCollapse: (id: string) => void;
  depth: number;
  palette: typeof bluePalettes[0];
}

function VerticalTreeNode({
  node, treeId, isAdmin, onEditMember, onAddChild, collapsedNodes, toggleCollapse, depth, palette
}: VerticalNodeProps) {
  const { person, children } = node;
  const isCollapsed = collapsedNodes.has(person.id);
  const hasChildren = children.length > 0;
  const isMale = person.gender === 'male';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
      {/* Node Row Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: `1.5px solid ${depth === 2 ? palette.primary : '#cbd5e1'}`,
        boxShadow: '0 2px 8px rgba(30, 58, 138, 0.05)',
        gap: 12,
        transition: 'all 0.15s ease',
      }}>
        {/* Person details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {/* Member Photo */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: isMale ? '#e0f2fe' : '#fdf2f8',
            border: `1.5px solid ${isMale ? '#93c5fd' : '#fbcfe8'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            {person.photo_url ? (
              <img
                src={person.photo_url}
                alt={person.full_name_ar}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={18} color={isMale ? '#0284c7' : '#db2777'} />
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <Link
              to={`/trees/${treeId}/member/${person.id}`}
              style={{
                fontFamily: 'Tajawal, sans-serif',
                fontWeight: 800,
                fontSize: '1rem',
                color: '#0f172a',
                textDecoration: 'none',
                display: 'block',
                lineHeight: 1.4,
              }}
            >
              {person.full_name_ar}
            </Link>
            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              {person.birth_year && <span>{person.birth_year}{person.death_year ? ` — ${person.death_year}` : ''}</span>}
              {!person.is_alive && (
                <span style={{ background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 6, fontSize: '0.65rem' }}>
                  رحمه الله
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions & Expand toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Expand/Collapse */}
          {hasChildren && (
            <button
              className="chart-interactive-control no-print"
              onClick={() => toggleCollapse(person.id)}
              style={{
                background: isCollapsed ? '#eff6ff' : palette.primary,
                color: isCollapsed ? palette.primary : '#ffffff',
                border: `1.5px solid ${palette.border}`,
                borderRadius: 'var(--radius-full)',
                padding: '3px 10px',
                fontSize: '0.72rem',
                fontFamily: 'Tajawal, sans-serif',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={isCollapsed ? 'عرض الأبناء' : 'طي الأبناء'}
            >
              <span>{children.length} {children.length === 1 ? 'ابن' : 'أبناء'}</span>
              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          )}

          {/* Admin Capsule */}
          {isAdmin && (
            <div
              className="chart-interactive-control no-print"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: '#f8fafc',
                padding: '2px 4px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid #e2e8f0',
              }}
            >
              {onAddChild && (
                <button
                  onClick={() => onAddChild(person)}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffffff', color: '#1d4ed8', border: '1px solid #bfdbfe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="إضافة أبناء لهذا الفرد"
                >
                  <Plus size={12} />
                </button>
              )}
              {onEditMember && (
                <button
                  onClick={() => onEditMember(person)}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="تعديل البيانات"
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Indented Subtree for Children */}
      {hasChildren && !isCollapsed && (
        <div style={{
          marginRight: 24,
          paddingRight: 16,
          borderRight: `2px solid ${palette.border}`,
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {children.map(child => (
            <VerticalTreeNode
              key={child.person.id}
              node={child}
              treeId={treeId}
              isAdmin={isAdmin}
              onEditMember={onEditMember}
              onAddChild={onAddChild}
              collapsedNodes={collapsedNodes}
              toggleCollapse={toggleCollapse}
              depth={depth + 1}
              palette={palette}
            />
          ))}
        </div>
      )}
    </div>
  );
}
