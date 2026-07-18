import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { User, Configuracion, CalculoSalario } from '../types';
import { MESES } from '../types';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { backgroundColor: '#1e293b', color: 'white', padding: 20, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  headerSub: { fontSize: 10, color: '#94a3b8' },
  photo: { width: 60, height: 60, borderRadius: 30 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { color: '#475569' },
  rowValue: { fontWeight: 'bold' },
  divider: { borderTopWidth: 1, borderTopColor: '#e2e8f0', marginVertical: 8 },
  totalBox: { backgroundColor: '#f0fdf4', borderLeftWidth: 3, borderLeftColor: '#22c55e', padding: 12, marginTop: 10 },
  netoLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  netoValue: { fontSize: 20, fontWeight: 'bold', color: '#16a34a' },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
  signatureBox: { width: '40%', alignItems: 'center' },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#94a3b8', width: '100%', marginBottom: 5 },
  signatureLabel: { fontSize: 9, color: '#64748b' },
  infoRow: { flexDirection: 'row', gap: 20, marginBottom: 5 },
  infoLabel: { color: '#64748b' },
  infoValue: { fontWeight: 'bold' },
});

interface Props {
  user: User | null;
  config: Configuracion | null;
  calculo: CalculoSalario;
  mes: number;
  anio: number;
  horas25: number;
  horas50: number;
  horas100: number;
}

function ReciboDocument({ user, config, calculo, mes, anio, horas25, horas50, horas100 }: Props) {
  const mesNombre = MESES[mes - 1];
  const fmt = (v: number) => `$ ${v.toFixed(2)}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>RECIBO DE SUELDO</Text>
            <Text style={styles.headerSub}>{mesNombre} {anio}</Text>
          </View>
          {user?.foto_perfil && (
            <Image src={user.foto_perfil} style={styles.photo} />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text><Text style={styles.infoLabel}>Empleado: </Text><Text style={styles.infoValue}>{user?.nombre || '-'}</Text></Text>
            <Text><Text style={styles.infoLabel}>C.I: </Text><Text style={styles.infoValue}>{user?.cedula || '-'}</Text></Text>
          </View>
          <View style={styles.infoRow}>
            <Text><Text style={styles.infoLabel}>Cargo: </Text><Text style={styles.infoValue}>{user?.cargo || '-'}</Text></Text>
            <Text><Text style={styles.infoLabel}>Valor Hora: </Text><Text style={styles.infoValue}>{fmt(calculo.valor_hora)}</Text></Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Asignaciones</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>Sueldo Base</Text><Text style={styles.rowValue}>{fmt(calculo.sueldo_base)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Horas Extras 25% ({horas25}h)</Text><Text style={styles.rowValue}>{fmt(calculo.recargo_25)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Horas Extras 50% ({horas50}h)</Text><Text style={styles.rowValue}>{fmt(calculo.recargo_50)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Horas Extras 100% ({horas100}h)</Text><Text style={styles.rowValue}>{fmt(calculo.recargo_100)}</Text></View>
          {calculo.fondos_reserva > 0 && (
            <View style={styles.row}><Text style={styles.rowLabel}>Fondos de Reserva ({config?.fondo_reserva_pct}%)</Text><Text style={styles.rowValue}>{fmt(calculo.fondos_reserva)}</Text></View>
          )}
          {calculo.bonificacion > 0 && (
            <View style={styles.row}><Text style={styles.rowLabel}>Bonificación</Text><Text style={styles.rowValue}>{fmt(calculo.bonificacion)}</Text></View>
          )}
          {calculo.conceptos_asignaciones?.map((c) => (
            <View key={c.id} style={styles.row}><Text style={styles.rowLabel}>{c.nombre}</Text><Text style={[styles.rowValue, { color: '#16a34a' }]}>+{fmt(c.monto)}</Text></View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}><Text style={{ fontWeight: 'bold' }}>Total Asignaciones</Text><Text style={{ fontWeight: 'bold' }}>{fmt(calculo.total_asignaciones)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deducibles</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>Aporte IESS ({config?.aporte_iess_pct}%)</Text><Text style={styles.rowValue}>{fmt(calculo.iess)}</Text></View>
          {calculo.subsidio_medico > 0 && (
            <View style={styles.row}><Text style={styles.rowLabel}>Subsidio Médico</Text><Text style={styles.rowValue}>{fmt(calculo.subsidio_medico)}</Text></View>
          )}
          {calculo.anticipo_quincena > 0 && (
            <View style={styles.row}><Text style={styles.rowLabel}>Anticipo de Quincena</Text><Text style={styles.rowValue}>{fmt(calculo.anticipo_quincena)}</Text></View>
          )}
          {calculo.prestamo_quirografario > 0 && (
            <View style={styles.row}><Text style={styles.rowLabel}>Préstamo Quirografario</Text><Text style={styles.rowValue}>{fmt(calculo.prestamo_quirografario)}</Text></View>
          )}
          {calculo.conceptos_deducciones?.map((c) => (
            <View key={c.id} style={styles.row}><Text style={styles.rowLabel}>{c.nombre}</Text><Text style={[styles.rowValue, { color: '#dc2626' }]}>-{fmt(c.monto)}</Text></View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}><Text style={{ fontWeight: 'bold' }}>Total Deducibles</Text><Text style={{ fontWeight: 'bold' }}>{fmt(calculo.total_deducibles)}</Text></View>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.netoLabel}>NETO A COBRAR</Text>
          <Text style={styles.netoValue}>{fmt(calculo.neto_cobrar)}</Text>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma del Empleado</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma del Empleador</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default function PdfDownload(props: Props) {
  const filename = `recibo_${MESES[props.mes - 1]}_${props.anio}.pdf`;

  return (
    <PDFDownloadLink
      document={<ReciboDocument {...props} />}
      fileName={filename}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition cursor-pointer text-sm"
    >
      {({ loading }) => loading ? 'Generando PDF...' : 'Descargar PDF'}
    </PDFDownloadLink>
  );
}
