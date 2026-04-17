/**
 * SISTEMA DE VALIDACIÓN AUTOMÁTICA
 * Detecta y reporta problemas de consistencia en viñetas generadas
 */

import type { SubPanel, Character, BackgroundAsset } from '../types';

export interface ValidationIssue {
  type: 'character_inconsistency' | 'background_inconsistency' | 'dimension_error' | 'quality_low' | 'composition_poor';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion: string;
  panelId?: string;
  characterId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  suggestions: string[];
}

/**
 * Valida las dimensiones de una imagen
 */
export const validateImageDimensions = async (
  imageUrl: string,
  expectedWidth: number,
  expectedHeight: number
): Promise<ValidationIssue | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const widthDiff = Math.abs(img.width - expectedWidth);
      const heightDiff = Math.abs(img.height - expectedHeight);
      
      // Tolerancia de 5px
      if (widthDiff > 5 || heightDiff > 5) {
        resolve({
          type: 'dimension_error',
          severity: 'critical',
          message: `Image dimensions incorrect: ${img.width}x${img.height}px (expected ${expectedWidth}x${expectedHeight}px)`,
          suggestion: `Regenerate the panel with correct dimensions`
        });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

/**
 * Valida la calidad de una imagen
 */
export const validateImageQuality = async (imageUrl: string): Promise<ValidationIssue | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Verificar resolución mínima
      const minDimension = Math.min(img.width, img.height);
      
      if (minDimension < 400) {
        resolve({
          type: 'quality_low',
          severity: 'warning',
          message: `Image quality is low (minimum dimension: ${minDimension}px)`,
          suggestion: `Increase resolution multiplier or regenerate`
        });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

/**
 * Valida un panel completo
 */
export const validatePanel = async (
  subPanel: SubPanel,
  expectedWidth: number,
  expectedHeight: number
): Promise<ValidationResult> => {
  const issues: ValidationIssue[] = [];
  
  if (!subPanel.imageUrl) {
    return {
      isValid: false,
      score: 0,
      issues: [{
        type: 'quality_low',
        severity: 'critical',
        message: 'Panel has no image',
        suggestion: 'Generate an image for this panel'
      }],
      suggestions: ['Generate an image for this panel']
    };
  }
  
  // Validar dimensiones
  const dimensionIssue = await validateImageDimensions(
    subPanel.imageUrl,
    expectedWidth,
    expectedHeight
  );
  if (dimensionIssue) {
    issues.push(dimensionIssue);
  }
  
  // Validar calidad
  const qualityIssue = await validateImageQuality(subPanel.imageUrl);
  if (qualityIssue) {
    issues.push(qualityIssue);
  }
  
  // Calcular score
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const warningIssues = issues.filter(i => i.severity === 'warning').length;
  
  let score = 100;
  score -= criticalIssues * 30;
  score -= warningIssues * 10;
  score = Math.max(0, score);
  
  const suggestions = issues.map(i => i.suggestion);
  
  return {
    isValid: criticalIssues === 0,
    score,
    issues,
    suggestions
  };
};

/**
 * Compara dos imágenes para detectar inconsistencias (básico)
 */
export const compareImages = async (
  imageUrl1: string,
  imageUrl2: string
): Promise<{ similarity: number; issues: string[] }> => {
  // Implementación básica - en el futuro usar embeddings
  return new Promise((resolve) => {
    const img1 = new Image();
    const img2 = new Image();
    
    let loaded = 0;
    const checkLoaded = () => {
      loaded++;
      if (loaded === 2) {
        // Comparación básica de dimensiones y aspect ratio
        const ratio1 = img1.width / img1.height;
        const ratio2 = img2.width / img2.height;
        const ratioDiff = Math.abs(ratio1 - ratio2);
        
        const issues: string[] = [];
        
        if (ratioDiff > 0.1) {
          issues.push('Aspect ratios are significantly different');
        }
        
        const sizeDiff = Math.abs(
          (img1.width * img1.height) - (img2.width * img2.height)
        );
        const avgSize = ((img1.width * img1.height) + (img2.width * img2.height)) / 2;
        const sizeDiffPercent = (sizeDiff / avgSize) * 100;
        
        if (sizeDiffPercent > 50) {
          issues.push('Image sizes are very different');
        }
        
        // Similarity básica (mejorar con embeddings en el futuro)
        const similarity = Math.max(0, 100 - (ratioDiff * 100) - (sizeDiffPercent / 2));
        
        resolve({ similarity, issues });
      }
    };
    
    img1.onload = checkLoaded;
    img2.onload = checkLoaded;
    img1.onerror = () => resolve({ similarity: 0, issues: ['Failed to load first image'] });
    img2.onerror = () => resolve({ similarity: 0, issues: ['Failed to load second image'] });
    
    img1.src = imageUrl1;
    img2.src = imageUrl2;
  });
};

/**
 * Valida consistencia entre viñetas consecutivas
 */
export const validateSequenceConsistency = async (
  panels: SubPanel[],
  characters: Character[]
): Promise<ValidationResult> => {
  const issues: ValidationIssue[] = [];
  
  if (panels.length < 2) {
    return {
      isValid: true,
      score: 100,
      issues: [],
      suggestions: []
    };
  }
  
  // Comparar viñetas consecutivas
  for (let i = 0; i < panels.length - 1; i++) {
    const panel1 = panels[i];
    const panel2 = panels[i + 1];
    
    if (!panel1.imageUrl || !panel2.imageUrl) continue;
    
    // Verificar si usan los mismos personajes
    const sharedCharacters = panel1.characterIds.filter(id => 
      panel2.characterIds.includes(id)
    );
    
    if (sharedCharacters.length > 0) {
      // Comparar imágenes
      const comparison = await compareImages(panel1.imageUrl, panel2.imageUrl);
      
      if (comparison.similarity < 60) {
        issues.push({
          type: 'character_inconsistency',
          severity: 'warning',
          message: `Low consistency between panels ${i + 1} and ${i + 2} (${comparison.similarity.toFixed(0)}% similar)`,
          suggestion: `Regenerate panel ${i + 2} with continuity from panel ${i + 1}`,
          panelId: panel2.id
        });
      }
      
      comparison.issues.forEach(issue => {
        issues.push({
          type: 'character_inconsistency',
          severity: 'info',
          message: `Between panels ${i + 1} and ${i + 2}: ${issue}`,
          suggestion: 'Consider regenerating with better continuity'
        });
      });
    }
  }
  
  // Calcular score
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const warningIssues = issues.filter(i => i.severity === 'warning').length;
  
  let score = 100;
  score -= criticalIssues * 30;
  score -= warningIssues * 10;
  score = Math.max(0, score);
  
  const suggestions = Array.from(new Set(issues.map(i => i.suggestion)));
  
  return {
    isValid: criticalIssues === 0,
    score,
    issues,
    suggestions
  };
};

/**
 * Genera un reporte de validación completo
 */
export const generateValidationReport = (results: ValidationResult[]): string => {
  const totalScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const allIssues = results.flatMap(r => r.issues);
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  
  let report = `# Validation Report\n\n`;
  report += `**Overall Score:** ${totalScore.toFixed(0)}/100\n\n`;
  report += `**Issues Found:**\n`;
  report += `- Critical: ${criticalCount}\n`;
  report += `- Warnings: ${warningCount}\n`;
  report += `- Info: ${allIssues.length - criticalCount - warningCount}\n\n`;
  
  if (allIssues.length > 0) {
    report += `## Issues:\n\n`;
    allIssues.forEach((issue, i) => {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️';
      report += `${i + 1}. ${icon} **${issue.type}**: ${issue.message}\n`;
      report += `   *Suggestion:* ${issue.suggestion}\n\n`;
    });
  } else {
    report += `✅ No issues found! All panels are valid.\n`;
  }
  
  return report;
};
